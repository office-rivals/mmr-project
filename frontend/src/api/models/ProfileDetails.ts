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
 * @interface ProfileDetails
 */
export interface ProfileDetails {
    /**
     * 
     * @type {number}
     * @memberof ProfileDetails
     */
    userId?: number;
    /**
     * 
     * @type {Array<number>}
     * @memberof ProfileDetails
     */
    colorCode?: Array<number>;
}

/**
 * Check if a given object implements the ProfileDetails interface.
 */
export function instanceOfProfileDetails(value: object): boolean {
    return true;
}

export function ProfileDetailsFromJSON(json: any): ProfileDetails {
    return ProfileDetailsFromJSONTyped(json, false);
}

export function ProfileDetailsFromJSONTyped(json: any, ignoreDiscriminator: boolean): ProfileDetails {
    if (json == null) {
        return json;
    }
    return {
        
        'userId': json['userId'] == null ? undefined : json['userId'],
        'colorCode': json['colorCode'] == null ? undefined : json['colorCode'],
    };
}

export function ProfileDetailsToJSON(value?: ProfileDetails | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'userId': value['userId'],
        'colorCode': value['colorCode'],
    };
}

