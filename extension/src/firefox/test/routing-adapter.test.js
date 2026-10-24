'use strict';

const Assert = require('node:assert');
const Routing = require('../../shared/routing-contract');
const Adapter = require('../background/routing-adapter');

const DIRECT_DECISION = Object.freeze({
  kind: Routing.KINDS.DIRECT,
  source: Routing.SOURCES.EXPLICIT_DIRECT,
});

function candidate(id, type, host, port, overrides = {}) {

  return Object.assign({
    id,
    type,
    host,
    port,
    proxyDNS: type === 'SOCKS4' || type === 'SOCKS5',
    authRef: null,
    failoverTimeoutSeconds: null,
  }, overrides);

}

function proxyDecision(candidates, fallback = Routing.FALLBACKS.FAIL_CLOSED) {

  return {
    kind: Routing.KINDS.PROXY,
    source: Routing.SOURCES.EXPLICIT_PROXY,
    candidates,
    fallback,
  };

}

function adapterForDecision(decision, options = {}) {

  return Adapter.createAdapter({
    initialState: Adapter.STATES.READY,
    decideRoute: options.decideRoute || ((value) => value),
    routingInputForRequest: options.routingInputForRequest || (() => decision),
    authorizations: options.authorizations,
    requestAuthContexts: options.requestAuthContexts,
  });

}

describe('Firefox fail-closed routing adapter', function() {

  it('leaves ordinary traffic alone while durable runtime is OFF', function() {

    const adapter = Adapter.createAdapter();

    Assert.strictEqual(adapter.runtimeState, Adapter.STATES.OFF);
    Assert.strictEqual(adapter.onProxyRequest({requestId: 'off'}), undefined);
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'off'}), {
      cancel: false,
    });
    Assert.strictEqual(adapter.authorizationCount(), 0);

  });

  it('distinguishes OFF from a true top-level-null Direct route', function() {

    const adapter = adapterForDecision(DIRECT_DECISION);

    Assert.strictEqual(adapter.onProxyRequest({requestId: 'direct'}), null);
    Assert.strictEqual(adapter.authorizationCount(), 1);
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'direct'}), {
      cancel: false,
    });
    Assert.strictEqual(adapter.authorizationCount(), 0);
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'direct'}), {
      cancel: true,
    });

  });

  it('maps an ordinary provider Direct decision to top-level null', function() {

    const adapter = adapterForDecision({
      kind: Routing.KINDS.DIRECT,
      source: Routing.SOURCES.PROVIDER_DEFAULT,
    });

    Assert.strictEqual(
        adapter.onProxyRequest({requestId: 'provider-direct'}),
        null,
    );
    Assert.deepStrictEqual(
        adapter.onBeforeRequest({requestId: 'provider-direct'}),
        {cancel: false},
    );

  });

  it('does not authorize Direct after a fail-closed proxy candidate', function() {

    const decision = proxyDecision([
      candidate('one', 'HTTPS', 'proxy-one.test', 443),
    ]);
    const adapter = adapterForDecision(decision);

    Assert.deepStrictEqual(Adapter.convertDecision(decision), {
      proxyResult: [
        {type: 'https', host: 'proxy-one.test', port: 443},
        null,
      ],
      callbackBudget: 1,
    });
    Assert.deepStrictEqual(
        adapter.onProxyRequest({requestId: 'proxy'}),
        [{type: 'https', host: 'proxy-one.test', port: 443}, null],
    );
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'proxy'}), {
      cancel: false,
    });
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'proxy'}), {
      cancel: true,
    });

  });

  it('budgets each ordered proxy callback and cancels terminal fallback', function() {

    const adapter = adapterForDecision(proxyDecision([
      candidate('one', 'HTTP', 'proxy-one.test', 8080),
      candidate('two', 'SOCKS5', '127.0.0.1', 9050, {
        failoverTimeoutSeconds: 4,
      }),
    ]));

    Assert.deepStrictEqual(adapter.onProxyRequest({requestId: 'failover'}), [
      {type: 'http', host: 'proxy-one.test', port: 8080},
      {
        type: 'socks',
        host: '127.0.0.1',
        port: 9050,
        proxyDNS: true,
        failoverTimeout: 4,
      },
      null,
    ]);
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'failover'}), {
      cancel: false,
    });
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'failover'}), {
      cancel: false,
    });
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'failover'}), {
      cancel: true,
    });

  });

  it('strips only proxy Direct fallback after validating every candidate',
      function() {

        const decision = proxyDecision([
          candidate('one', 'HTTP', 'proxy-one.test', 8080),
          candidate('two', 'SOCKS4', '127.0.0.1', 9150),
        ], Routing.FALLBACKS.DIRECT);
        const adapter = adapterForDecision(decision);

        Assert.deepStrictEqual(Adapter.convertDecision(decision), {
          proxyResult: [
            {type: 'http', host: 'proxy-one.test', port: 8080},
            {type: 'socks4', host: '127.0.0.1', port: 9150, proxyDNS: true},
            null,
          ],
          callbackBudget: 2,
          degradationCode:
            Adapter.DEGRADATION_CODES.PROXY_DIRECT_FALLBACK_STRIPPED,
        });
        Assert.deepStrictEqual(
            adapter.onProxyRequest({requestId: 'fallback'}),
            [
              {type: 'http', host: 'proxy-one.test', port: 8080},
              {type: 'socks4', host: '127.0.0.1', port: 9150, proxyDNS: true},
              null,
            ],
        );
        Assert.strictEqual(adapter.authorizationCount(), 1);
        Assert.deepStrictEqual(
            adapter.onBeforeRequest({requestId: 'fallback'}),
            {cancel: false},
        );
        Assert.deepStrictEqual(
            adapter.onBeforeRequest({requestId: 'fallback'}),
            {cancel: false},
        );
        Assert.strictEqual(adapter.authorizationCount(), 0);
        Assert.deepStrictEqual(
            adapter.onBeforeRequest({requestId: 'fallback'}),
            {cancel: true},
        );

      });

  it('gives one provider proxy one callback without terminal Direct', function() {

    const decision = {
      kind: Routing.KINDS.PROXY,
      source: Routing.SOURCES.PROVIDER_DEFAULT,
      candidates: [candidate('provider', 'HTTPS', 'provider.test', 443)],
      fallback: Routing.FALLBACKS.DIRECT,
    };
    const adapter = adapterForDecision(decision);

    Assert.deepStrictEqual(Adapter.convertDecision(decision), {
      proxyResult: [
        {type: 'https', host: 'provider.test', port: 443},
        null,
      ],
      callbackBudget: 1,
      degradationCode:
        Adapter.DEGRADATION_CODES.PROXY_DIRECT_FALLBACK_STRIPPED,
    });
    Assert.deepStrictEqual(adapter.onProxyRequest({requestId: 'provider'}), [
      {type: 'https', host: 'provider.test', port: 443},
      null,
    ]);
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'provider'}), {
      cancel: false,
    });
    Assert.strictEqual(adapter.authorizationCount(), 0);
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'provider'}), {
      cancel: true,
    });

  });

  it('cancels missing and malformed authorization markers', function() {

    const malformed = new Map([['bad', '1']]);
    const adapter = adapterForDecision(DIRECT_DECISION, {
      authorizations: malformed,
    });

    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'missing'}), {
      cancel: true,
    });
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'bad'}), {
      cancel: true,
    });
    Assert.strictEqual(malformed.has('bad'), false);

  });

  it('does not evict an active authorization when the map cap is reached', function() {

    const adapter = adapterForDecision(DIRECT_DECISION);
    for (let index = 0; index < Adapter.MAX_AUTHORIZATIONS; index += 1) {
      adapter.onProxyRequest({requestId: `active-${index}`});
    }

    Assert.strictEqual(adapter.authorizationCount(), Adapter.MAX_AUTHORIZATIONS);
    Assert.deepStrictEqual(adapter.onProxyRequest({requestId: 'overflow'}), {
      type: 'direct',
    });
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'overflow'}), {
      cancel: true,
    });
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'active-0'}), {
      cancel: false,
    });

  });

  it('cleans an authorization defensively on terminal events', function() {

    const adapter = adapterForDecision(DIRECT_DECISION);
    adapter.onProxyRequest({requestId: 'terminal'});
    Assert.strictEqual(adapter.authorizationCount(), 1);

    adapter.onRequestTerminal({requestId: 'terminal'});

    Assert.strictEqual(adapter.authorizationCount(), 0);
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'terminal'}), {
      cancel: true,
    });

  });

  it('strips opaque authRef while preserving a valid proxy candidate', function() {

    const authenticated = candidate(
        'authenticated',
        'HTTPS',
        'proxy.test',
        443,
        {authRef: 'fixture-auth'},
    );
    const proxyInfo = Adapter.candidateToProxyInfo(authenticated);

    Assert.deepStrictEqual(proxyInfo, {
      type: 'https',
      host: 'proxy.test',
      port: 443,
    });
    Assert.strictEqual(
        Object.prototype.hasOwnProperty.call(proxyInfo, 'authRef'),
        false,
    );

  });

  it('tracks the selected authenticated proxy by request and challenger',
      function() {

        const adapter = adapterForDecision(proxyDecision([
          candidate('auth', 'HTTP', 'Proxy.Test', 8080, {
            authRef: 'fixture-auth',
          }),
        ]));
        const challenge = {
          requestId: 'authenticated',
          isProxy: true,
          challenger: {host: 'proxy.test', port: 8080},
        };

        adapter.onProxyRequest({requestId: 'authenticated'});
        Assert.strictEqual(adapter.authContextCount(), 1);
        Assert.deepStrictEqual(adapter.onBeforeRequest({
          requestId: 'authenticated',
          proxyInfo: {type: 'http', host: 'PROXY.TEST', port: 8080},
        }), {cancel: false});
        Assert.deepStrictEqual(adapter.authenticationForChallenge(challenge), {
          authRef: 'fixture-auth',
          endpointKey: 'proxy.test:8080',
        });
        Assert.strictEqual(
            adapter.authorizeAuthenticationRetry(challenge, 'fixture-auth'),
            true,
        );
        Assert.deepStrictEqual(adapter.onBeforeRequest({
          requestId: 'authenticated',
          proxyInfo: {type: 'http', host: 'proxy.test', port: 8080},
        }), {cancel: false});
        Assert.strictEqual(adapter.authorizationCount(), 0);
        Assert.strictEqual(adapter.authContextCount(), 1);

      });

  it('does not extend a callback budget for a mismatched endpoint or request',
      function() {

        const adapter = adapterForDecision(proxyDecision([
          candidate('auth', 'HTTP', 'proxy.test', 8080, {
            authRef: 'fixture-auth',
          }),
        ]));
        adapter.onProxyRequest({requestId: 'known'});
        adapter.onBeforeRequest({
          requestId: 'known',
          proxyInfo: {type: 'http', host: 'proxy.test', port: 8080},
        });

        for (const details of [
          {
            requestId: 'unknown',
            isProxy: true,
            challenger: {host: 'proxy.test', port: 8080},
          },
          {
            requestId: 'known',
            isProxy: true,
            challenger: {host: 'proxy.test', port: 8081},
          },
          {
            requestId: 'known',
            isProxy: false,
            challenger: {host: 'proxy.test', port: 8080},
          },
        ]) {
          Assert.strictEqual(
              adapter.authorizeAuthenticationRetry(details, 'fixture-auth'),
              false,
          );
        }
        Assert.strictEqual(adapter.authorizationCount(), 0);

      });

  it('rejects ambiguous authRefs for the same proxy endpoint', function() {

    const decision = proxyDecision([
      candidate('first', 'HTTP', 'proxy.test', 8080, {authRef: 'first'}),
      candidate('second', 'HTTPS', 'PROXY.TEST', 8080, {authRef: 'second'}),
    ]);
    const adapter = adapterForDecision(decision);

    Assert.strictEqual(Adapter.convertDecision(decision), null);
    Assert.deepStrictEqual(adapter.onProxyRequest({requestId: 'ambiguous'}), {
      type: 'direct',
    });
    Assert.strictEqual(adapter.authorizationCount(), 0);
    Assert.strictEqual(adapter.authContextCount(), 0);

  });

  it('allows bounded browser origin-auth retries on the original Direct or proxy route',
      function() {

        for (const proxyInfo of [null,
          {type: 'http', host: 'proxy.test', port: 8080},
        ]) {
          const authorizations = new Map();
          const adapter = adapterForDecision(proxyInfo ? proxyDecision([
            candidate('proxy', 'HTTP', 'proxy.test', 8080),
          ]) : DIRECT_DECISION, {authorizations});
          const request = {requestId: 'origin-auth',
            url: 'https://origin.test/private', proxyInfo};
          const challenge = Object.assign({}, request, {
            statusCode: 401, responseHeaders: [{name: 'WWW-Authenticate'}],
          });
          adapter.onProxyRequest(request);
          // A challenge cannot authorize a route which has not passed the guard.
          Assert.strictEqual(adapter.onHeadersReceived(challenge), undefined);
          Assert.strictEqual(authorizations.get(request.requestId), 1);
          Assert.deepStrictEqual(adapter.onBeforeRequest(request), {cancel: false});
          for (let retry = 0; retry < Adapter.MAX_ORIGIN_AUTH_RETRIES; retry += 1) {
            Assert.strictEqual(adapter.onHeadersReceived(challenge), undefined);
            Assert.strictEqual(authorizations.get(request.requestId), 1);
            Assert.strictEqual(adapter.onHeadersReceived(challenge), undefined);
            Assert.strictEqual(authorizations.get(request.requestId), 1);
            Assert.deepStrictEqual(adapter.onBeforeRequest(request), {cancel: false});
            Assert.strictEqual(adapter.authorizationCount(), 0);
          }
          Assert.strictEqual(adapter.onHeadersReceived(challenge), undefined);
          Assert.strictEqual(adapter.authorizationCount(), 0);
          Assert.deepStrictEqual(adapter.onBeforeRequest(request), {cancel: true});
          adapter.onRequestTerminal(request);
          Assert.strictEqual(adapter.authContextCount(), 0);
          Assert.strictEqual(adapter.onHeadersReceived(challenge), undefined);
          Assert.strictEqual(adapter.authorizationCount(), 0);
        }

      });

  it('requires a 401 origin challenge from the authorized request, origin and route',
      function() {

        const adapter = adapterForDecision(DIRECT_DECISION);
        const request = {requestId: 'origin-auth', url: 'http://origin.test:8081/private'};
        const challenge = Object.assign({}, request, {
          statusCode: 401, responseHeaders: [{name: 'www-authenticate'}],
        });
        adapter.onProxyRequest(request);
        adapter.onBeforeRequest(request);
        for (const override of [
          {requestId: 'unknown'},
          {url: 'http://other.test:8081/private'},
          {url: 'https://origin.test:8081/private'},
          {url: 'http://origin.test:8082/private'},
          {url: 'invalid'},
          {proxyInfo: {type: 'http', host: 'proxy.test', port: 8080}},
          {statusCode: 407},
          {statusCode: 200},
          {responseHeaders: [{name: 'Proxy-Authenticate'}]},
          {responseHeaders: []},
          {responseHeaders: null},
        ]) {
          Assert.strictEqual(adapter.onHeadersReceived(
              Object.assign({}, challenge, override)), undefined);
          Assert.strictEqual(adapter.authorizationCount(), 0);
        }
        Assert.strictEqual(adapter.onHeadersReceived(challenge), undefined);
        Assert.strictEqual(adapter.authorizationCount(), 1);
        adapter.clearAllAuthorizations();
        Assert.strictEqual(adapter.onHeadersReceived(challenge), undefined);
        Assert.strictEqual(adapter.authorizationCount(), 0);
        Assert.deepStrictEqual(adapter.onBeforeRequest(request), {cancel: true});

      });

  it('does not spend origin retry authorization on a changed route or origin',
      function() {

        const proxyInfo = {type: 'http', host: 'proxy.test', port: 8080};
        for (const override of [
          {proxyInfo: null},
          {proxyInfo: {type: 'https', host: 'proxy.test', port: 8080}},
          {proxyInfo: {type: 'http', host: 'other.test', port: 8080}},
          {url: 'http://other.test/private'},
        ]) {
          const adapter = adapterForDecision(proxyDecision([
            candidate('proxy', 'HTTP', 'proxy.test', 8080),
          ]));
          const request = {requestId: 'origin-auth', url: 'http://origin.test/private',
            proxyInfo};
          adapter.onProxyRequest(request);
          adapter.onBeforeRequest(request);
          Assert.strictEqual(adapter.onHeadersReceived(
              Object.assign({}, request, {statusCode: 401,
                responseHeaders: [{name: 'WWW-Authenticate'}]})), undefined);
          Assert.strictEqual(adapter.authorizationCount(), 1);
          Assert.deepStrictEqual(adapter.onBeforeRequest(
              Object.assign({}, request, override)), {cancel: true});
          Assert.strictEqual(adapter.authorizationCount(), 0);
          Assert.strictEqual(adapter.authContextCount(), 0);
        }

      });

  it('does not grant origin retries while OFF or recovering, or after recreation',
      function() {

        const request = {requestId: 'origin-auth', url: 'https://origin.test/'};
        const challenge = Object.assign({}, request, {
          statusCode: 401, responseHeaders: [{name: 'WWW-Authenticate'}],
        });
        for (const unavailable of [Adapter.STATES.OFF, Adapter.STATES.INITIALIZING,
          Adapter.STATES.FAILED,
        ]) {
          let state = Adapter.STATES.READY;
          const adapter = Adapter.createAdapter({
            runtimeStateForRequest: () => state,
            decideRoute: () => DIRECT_DECISION,
            routingInputForRequest: () => null,
          });
          adapter.onProxyRequest(request);
          adapter.onBeforeRequest(request);
          state = unavailable;
          Assert.strictEqual(adapter.onHeadersReceived(challenge), undefined);
          Assert.strictEqual(adapter.authorizationCount(), 0);
        }
        const recreated = adapterForDecision(DIRECT_DECISION);
        Assert.strictEqual(recreated.onHeadersReceived(challenge), undefined);
        Assert.strictEqual(recreated.authorizationCount(), 0);

      });

  it('fails closed for malformed injected route-auth state', function() {

    const requestAuthContexts = new Map([['malformed', {
      candidates: [],
      selected: {
        authRef: 'fixture-auth',
        endpointKey: 'proxy.test:8080',
      },
    }]]);
    const adapter = adapterForDecision(null, {requestAuthContexts});

    Assert.strictEqual(adapter.authenticationForChallenge({
      requestId: 'malformed',
      isProxy: true,
      challenger: {host: 'proxy.test', port: 8080},
    }), null);
    Assert.strictEqual(adapter.authorizationCount(), 0);

  });

  it('fails closed before authorization for invalid candidates', function() {

    for (const invalid of [
      candidate('bad-host', 'HTTP', 'https://proxy.test', 8080),
      candidate('bad-port', 'HTTP', 'proxy.test', 0),
      candidate('bad-auth-ref', 'HTTPS', 'proxy.test', 443, {
        authRef: 'not valid',
      }),
      Object.assign(
          candidate('credential', 'HTTP', 'proxy.test', 8080),
          {password: 'x'},
      ),
    ]) {
      const adapter = adapterForDecision(proxyDecision(
          [invalid],
          Routing.FALLBACKS.DIRECT,
      ));
      Assert.deepStrictEqual(adapter.onProxyRequest({requestId: invalid.id}), {
        type: 'direct',
      });
      Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: invalid.id}), {
        cancel: true,
      });
      Assert.strictEqual(adapter.authorizationCount(), 0);
      Assert.strictEqual(adapter.authContextCount(), 0);
    }

  });

  it('fails closed for empty, malformed, and core FAIL_CLOSED decisions',
      function() {

        for (const decision of [
          proxyDecision([], Routing.FALLBACKS.DIRECT),
          {
            kind: Routing.KINDS.PROXY,
            source: Routing.SOURCES.PROVIDER_DEFAULT,
            candidates: 'not-an-array',
            fallback: Routing.FALLBACKS.DIRECT,
          },
          {
            kind: Routing.KINDS.FAIL_CLOSED,
            source: Routing.SOURCES.ROUTING_INPUT,
            code: 'NO_VALID_ROUTE',
          },
        ]) {
          const adapter = adapterForDecision(decision);
          Assert.deepStrictEqual(
              adapter.onProxyRequest({requestId: 'closed'}),
              {type: 'direct'},
          );
          Assert.deepStrictEqual(
              adapter.onBeforeRequest({requestId: 'closed'}),
              {cancel: true},
          );
          Assert.strictEqual(adapter.authorizationCount(), 0);
        }

      });

  it('fails closed when route selection throws or returns async state', function() {

    for (const decideRoute of [
      () => {

        throw new Error('injected routing failure');

      },
      () => Promise.resolve(DIRECT_DECISION),
    ]) {
      const adapter = adapterForDecision(null, {decideRoute});
      Assert.deepStrictEqual(adapter.onProxyRequest({requestId: 'failure'}), {
        type: 'direct',
      });
      Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'failure'}), {
        cancel: true,
      });
      Assert.strictEqual(adapter.authorizationCount(), 0);
    }

  });

  it('cancels in INITIALIZING and FAILED without routing authorization', function() {

    for (const state of [Adapter.STATES.INITIALIZING, Adapter.STATES.FAILED]) {
      const adapter = Adapter.createAdapter({initialState: state});
      Assert.deepStrictEqual(adapter.onProxyRequest({requestId: state}), {
        type: 'direct',
      });
      Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: state}), {
        cancel: true,
      });
      Assert.strictEqual(adapter.authorizationCount(), 0);
    }

  });

  it('catches synchronous guard state failures and cancels', function() {

    const brokenMap = {
      delete() {},
      get() {

        throw new Error('injected lookup failure');

      },
      get size() {

        return 0;

      },
    };
    const adapter = adapterForDecision(DIRECT_DECISION, {
      authorizations: brokenMap,
    });

    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'fault'}), {
      cancel: true,
    });
    Assert.strictEqual(adapter.authorizationCount(), 0);

  });

  it('starts every recreated event-page adapter with no authorization', function() {

    const first = adapterForDecision(DIRECT_DECISION);
    first.onProxyRequest({requestId: 'old-request'});
    const recreated = adapterForDecision(DIRECT_DECISION);

    Assert.strictEqual(first.authorizationCount(), 1);
    Assert.strictEqual(recreated.authorizationCount(), 0);
    Assert.deepStrictEqual(
        recreated.onBeforeRequest({requestId: 'old-request'}),
        {cancel: true},
    );

  });

  it('preserves shared candidate order and Firefox type mapping', function() {

    const input = {
      hostname: 'protected.test',
      rules: {proxy: ['protected.test']},
      candidateGroups: {
        configured: {
          own: [candidate('own', 'HTTPS', 'own.test', 8443)],
          localTor: [candidate('tor', 'SOCKS5', '127.0.0.1', 9050)],
          torBrowser: [candidate('browser', 'SOCKS4', '127.0.0.1', 9150)],
          warp: [candidate('warp', 'HTTP', '127.0.0.1', 40000)],
        },
      },
    };
    const adapter = Adapter.createAdapter({
      initialState: Adapter.STATES.READY,
      routingInputForRequest: () => input,
    });

    Assert.deepStrictEqual(adapter.onProxyRequest({requestId: 'ordered'}), [
      {type: 'https', host: 'own.test', port: 8443},
      {type: 'socks', host: '127.0.0.1', port: 9050, proxyDNS: true},
      {type: 'socks4', host: '127.0.0.1', port: 9150, proxyDNS: true},
      {type: 'http', host: '127.0.0.1', port: 40000},
      null,
    ]);

  });

  it('keeps authorizations isolated by exact request ID under concurrency', function() {

    const adapter = Adapter.createAdapter({
      initialState: Adapter.STATES.READY,
      decideRoute: (value) => value,
      routingInputForRequest(details) {

        return details.requestId === 'direct' ?
          DIRECT_DECISION :
          proxyDecision([candidate('proxy', 'HTTP', 'proxy.test', 8080)]);

      },
    });
    adapter.onProxyRequest({requestId: 'proxy'});
    adapter.onProxyRequest({requestId: 'direct'});

    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'unknown'}), {
      cancel: true,
    });
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'direct'}), {
      cancel: false,
    });
    Assert.deepStrictEqual(adapter.onBeforeRequest({requestId: 'proxy'}), {
      cancel: false,
    });
    Assert.strictEqual(adapter.authorizationCount(), 0);

  });

  it('clears every ephemeral authorization for OFF/Clear reconciliation',
      function() {

        const adapter = adapterForDecision(DIRECT_DECISION);
        adapter.onProxyRequest({requestId: 'first'});
        adapter.onProxyRequest({requestId: 'second'});
        Assert.strictEqual(adapter.authorizationCount(), 2);

        adapter.clearAllAuthorizations();

        Assert.strictEqual(adapter.authorizationCount(), 0);
        Assert.strictEqual(adapter.authContextCount(), 0);
        Assert.deepStrictEqual(
            adapter.onBeforeRequest({requestId: 'first'}),
            {cancel: true},
        );

      });

});
