import { SetMetadata } from '@nestjs/common';

export const IS_SKIP_CACHE_KEY = 'isSkipCache';

/**
 * Marks a route (or an entire controller) as requiring the `X-Skip-Cache`
 * response header — enforced by the global `SkipCacheInterceptor`. Tent's
 * `default_proxy` rule caches any 2xx response to a `*.json` URL by
 * method-agnostic, query-string-only key, so routes returning
 * per-caller credentials/tokens must opt out via this header.
 * @returns {MethodDecorator & ClassDecorator} The metadata decorator.
 */
export const SkipCache = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_SKIP_CACHE_KEY, true);
