/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentmail from "../agentmail.js";
import type * as agentmailInboxes from "../agentmailInboxes.js";
import type * as answerQuestion from "../answerQuestion.js";
import type * as drafts from "../drafts.js";
import type * as faqs from "../faqs.js";
import type * as http from "../http.js";
import type * as importListing from "../importListing.js";
import type * as learn from "../learn.js";
import type * as lib_svix from "../lib/svix.js";
import type * as listings from "../listings.js";
import type * as opsMessages from "../opsMessages.js";
import type * as stays from "../stays.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentmail: typeof agentmail;
  agentmailInboxes: typeof agentmailInboxes;
  answerQuestion: typeof answerQuestion;
  drafts: typeof drafts;
  faqs: typeof faqs;
  http: typeof http;
  importListing: typeof importListing;
  learn: typeof learn;
  "lib/svix": typeof lib_svix;
  listings: typeof listings;
  opsMessages: typeof opsMessages;
  stays: typeof stays;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
