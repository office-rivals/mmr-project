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


/**
 * 
 * @export
 */
export const PendingMatchStatus = {
    NUMBER_0: 0,
    NUMBER_1: 1,
    NUMBER_2: 2
} as const;
export type PendingMatchStatus = typeof PendingMatchStatus[keyof typeof PendingMatchStatus];


export function instanceOfPendingMatchStatus(value: any): boolean {
    return Object.values(PendingMatchStatus).includes(value);
}

export function PendingMatchStatusFromJSON(json: any): PendingMatchStatus {
    return PendingMatchStatusFromJSONTyped(json, false);
}

export function PendingMatchStatusFromJSONTyped(json: any, ignoreDiscriminator: boolean): PendingMatchStatus {
    return json as PendingMatchStatus;
}

export function PendingMatchStatusToJSON(value?: PendingMatchStatus | null): any {
    return value as any;
}
