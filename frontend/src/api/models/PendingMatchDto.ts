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

import { mapValues } from '../runtime';
import type { PendingMatchStatus } from './PendingMatchStatus';
import {
    PendingMatchStatusFromJSON,
    PendingMatchStatusFromJSONTyped,
    PendingMatchStatusToJSON,
} from './PendingMatchStatus';

/**
 * 
 * @export
 * @interface PendingMatchDto
 */
export interface PendingMatchDto {
    /**
     * 
     * @type {string}
     * @memberof PendingMatchDto
     */
    id: string;
    /**
     * 
     * @type {PendingMatchStatus}
     * @memberof PendingMatchDto
     */
    status: PendingMatchStatus;
}

/**
 * Check if a given object implements the PendingMatchDto interface.
 */
export function instanceOfPendingMatchDto(value: object): boolean {
    if (!('id' in value)) return false;
    if (!('status' in value)) return false;
    return true;
}

export function PendingMatchDtoFromJSON(json: any): PendingMatchDto {
    return PendingMatchDtoFromJSONTyped(json, false);
}

export function PendingMatchDtoFromJSONTyped(json: any, ignoreDiscriminator: boolean): PendingMatchDto {
    if (json == null) {
        return json;
    }
    return {
        
        'id': json['id'],
        'status': PendingMatchStatusFromJSON(json['status']),
    };
}

export function PendingMatchDtoToJSON(value?: PendingMatchDto | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'id': value['id'],
        'status': PendingMatchStatusToJSON(value['status']),
    };
}

