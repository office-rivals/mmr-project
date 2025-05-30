/* tslint:disable */
/* eslint-disable */
/**
 * MMRProject.Api
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


import * as runtime from '../runtime';

export interface AdminRecalculateMatchesRequest {
    fromMatchId?: number;
    xAPIKEY?: string;
}

/**
 * 
 */
export class AdminApi extends runtime.BaseAPI {

    /**
     */
    async adminRecalculateMatchesRaw(requestParameters: AdminRecalculateMatchesRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        const queryParameters: any = {};

        if (requestParameters['fromMatchId'] != null) {
            queryParameters['fromMatchId'] = requestParameters['fromMatchId'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (requestParameters['xAPIKEY'] != null) {
            headerParameters['X-API-KEY'] = String(requestParameters['xAPIKEY']);
        }

        const response = await this.request({
            path: `/api/v1/admin/recalculate`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     */
    async adminRecalculateMatches(requestParameters: AdminRecalculateMatchesRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.adminRecalculateMatchesRaw(requestParameters, initOverrides);
    }

}
