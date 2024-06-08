/* tslint:disable */
/* eslint-disable */
/**
 * 
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 1.0.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


import * as runtime from '../runtime';
import type {
  ViewMatch,
  ViewMatchDetails,
  ViewMatchDetailsV2,
  ViewMatchV2,
} from '../models/index';
import {
    ViewMatchFromJSON,
    ViewMatchToJSON,
    ViewMatchDetailsFromJSON,
    ViewMatchDetailsToJSON,
    ViewMatchDetailsV2FromJSON,
    ViewMatchDetailsV2ToJSON,
    ViewMatchV2FromJSON,
    ViewMatchV2ToJSON,
} from '../models/index';

export interface V1MmrMatchesGetRequest {
    limit?: number;
    offset?: number;
}

export interface V1MmrMatchesPostRequest {
    match: ViewMatch;
}

export interface V2MmrMatchesGetRequest {
    limit?: number;
    offset?: number;
    userId?: number;
}

export interface V2MmrMatchesPostRequest {
    match: ViewMatchV2;
}

/**
 * 
 */
export class MatchesApi extends runtime.BaseAPI {

    /**
     * Get all matches
     * Get matches
     */
    async v1MmrMatchesGetRaw(requestParameters: V1MmrMatchesGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<ViewMatchDetails>>> {
        const queryParameters: any = {};

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
        }

        if (requestParameters['offset'] != null) {
            queryParameters['offset'] = requestParameters['offset'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/mmr/matches`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(ViewMatchDetailsFromJSON));
    }

    /**
     * Get all matches
     * Get matches
     */
    async v1MmrMatchesGet(requestParameters: V1MmrMatchesGetRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<ViewMatchDetails>> {
        const response = await this.v1MmrMatchesGetRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Submit a match for MMR calculation
     * Submit a match
     */
    async v1MmrMatchesPostRaw(requestParameters: V1MmrMatchesPostRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<string>> {
        if (requestParameters['match'] == null) {
            throw new runtime.RequiredError(
                'match',
                'Required parameter "match" was null or undefined when calling v1MmrMatchesPost().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/mmr/matches`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: ViewMatchToJSON(requestParameters['match']),
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<string>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Submit a match for MMR calculation
     * Submit a match
     */
    async v1MmrMatchesPost(requestParameters: V1MmrMatchesPostRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<string> {
        const response = await this.v1MmrMatchesPostRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get all matches
     * Get matches
     */
    async v2MmrMatchesGetRaw(requestParameters: V2MmrMatchesGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<ViewMatchDetailsV2>>> {
        const queryParameters: any = {};

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
        }

        if (requestParameters['offset'] != null) {
            queryParameters['offset'] = requestParameters['offset'];
        }

        if (requestParameters['userId'] != null) {
            queryParameters['userId'] = requestParameters['userId'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v2/mmr/matches`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(ViewMatchDetailsV2FromJSON));
    }

    /**
     * Get all matches
     * Get matches
     */
    async v2MmrMatchesGet(requestParameters: V2MmrMatchesGetRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<ViewMatchDetailsV2>> {
        const response = await this.v2MmrMatchesGetRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Submit a match for MMR calculation
     * Submit a match
     */
    async v2MmrMatchesPostRaw(requestParameters: V2MmrMatchesPostRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<string>> {
        if (requestParameters['match'] == null) {
            throw new runtime.RequiredError(
                'match',
                'Required parameter "match" was null or undefined when calling v2MmrMatchesPost().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v2/mmr/matches`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: ViewMatchV2ToJSON(requestParameters['match']),
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<string>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Submit a match for MMR calculation
     * Submit a match
     */
    async v2MmrMatchesPost(requestParameters: V2MmrMatchesPostRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<string> {
        const response = await this.v2MmrMatchesPostRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
