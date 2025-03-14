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
/**
 * 
 * @export
 * @interface MatchTeamV2
 */
export interface MatchTeamV2 {
    /**
     * 
     * @type {number}
     * @memberof MatchTeamV2
     */
    score: number;
    /**
     * 
     * @type {number}
     * @memberof MatchTeamV2
     */
    member1: number;
    /**
     * 
     * @type {number}
     * @memberof MatchTeamV2
     */
    member2: number;
}

/**
 * Check if a given object implements the MatchTeamV2 interface.
 */
export function instanceOfMatchTeamV2(value: object): boolean {
    if (!('score' in value)) return false;
    if (!('member1' in value)) return false;
    if (!('member2' in value)) return false;
    return true;
}

export function MatchTeamV2FromJSON(json: any): MatchTeamV2 {
    return MatchTeamV2FromJSONTyped(json, false);
}

export function MatchTeamV2FromJSONTyped(json: any, ignoreDiscriminator: boolean): MatchTeamV2 {
    if (json == null) {
        return json;
    }
    return {
        
        'score': json['score'],
        'member1': json['member1'],
        'member2': json['member2'],
    };
}

export function MatchTeamV2ToJSON(value?: MatchTeamV2 | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'score': value['score'],
        'member1': value['member1'],
        'member2': value['member2'],
    };
}

