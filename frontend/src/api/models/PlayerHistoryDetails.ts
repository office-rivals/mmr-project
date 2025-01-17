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
 * @interface PlayerHistoryDetails
 */
export interface PlayerHistoryDetails {
    /**
     * 
     * @type {number}
     * @memberof PlayerHistoryDetails
     */
    userId: number;
    /**
     * 
     * @type {string}
     * @memberof PlayerHistoryDetails
     */
    name: string;
    /**
     * 
     * @type {Date}
     * @memberof PlayerHistoryDetails
     */
    date: Date;
    /**
     * 
     * @type {number}
     * @memberof PlayerHistoryDetails
     */
    mmr: number;
}

/**
 * Check if a given object implements the PlayerHistoryDetails interface.
 */
export function instanceOfPlayerHistoryDetails(value: object): boolean {
    if (!('userId' in value)) return false;
    if (!('name' in value)) return false;
    if (!('date' in value)) return false;
    if (!('mmr' in value)) return false;
    return true;
}

export function PlayerHistoryDetailsFromJSON(json: any): PlayerHistoryDetails {
    return PlayerHistoryDetailsFromJSONTyped(json, false);
}

export function PlayerHistoryDetailsFromJSONTyped(json: any, ignoreDiscriminator: boolean): PlayerHistoryDetails {
    if (json == null) {
        return json;
    }
    return {
        
        'userId': json['userId'],
        'name': json['name'],
        'date': (new Date(json['date'])),
        'mmr': json['mmr'],
    };
}

export function PlayerHistoryDetailsToJSON(value?: PlayerHistoryDetails | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'userId': value['userId'],
        'name': value['name'],
        'date': ((value['date']).toISOString()),
        'mmr': value['mmr'],
    };
}
