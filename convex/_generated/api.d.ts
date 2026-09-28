/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as games from "../games.js";
import type * as partyModel from "../partyModel.js";
import type * as quiz from "../quiz.js";
import type * as quizModel from "../quizModel.js";
import type * as roomAccess from "../roomAccess.js";
import type * as rooms from "../rooms.js";
import type * as wordList from "../wordList.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  games: typeof games;
  partyModel: typeof partyModel;
  quiz: typeof quiz;
  quizModel: typeof quizModel;
  roomAccess: typeof roomAccess;
  rooms: typeof rooms;
  wordList: typeof wordList;
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
