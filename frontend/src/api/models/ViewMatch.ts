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

import { mapValues } from '../runtime';
import type { ViewMatchTeam } from './ViewMatchTeam';
import {
    ViewMatchTeamFromJSON,
    ViewMatchTeamFromJSONTyped,
    ViewMatchTeamToJSON,
} from './ViewMatchTeam';

/**
 * 
 * @export
 * @interface ViewMatch
 */
export interface ViewMatch {
    /**
     * 
     * @type {ViewMatchTeam}
     * @memberof ViewMatch
     */
    team1: ViewMatchTeam;
    /**
     * 
     * @type {ViewMatchTeam}
     * @memberof ViewMatch
     */
    team2: ViewMatchTeam;
}

/**
 * Check if a given object implements the ViewMatch interface.
 */
export function instanceOfViewMatch(value: object): boolean {
    if (!('team1' in value)) return false;
    if (!('team2' in value)) return false;
    return true;
}

export function ViewMatchFromJSON(json: any): ViewMatch {
    return ViewMatchFromJSONTyped(json, false);
}

export function ViewMatchFromJSONTyped(json: any, ignoreDiscriminator: boolean): ViewMatch {
    if (json == null) {
        return json;
    }
    return {
        
        'team1': ViewMatchTeamFromJSON(json['team1']),
        'team2': ViewMatchTeamFromJSON(json['team2']),
    };
}

export function ViewMatchToJSON(value?: ViewMatch | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'team1': ViewMatchTeamToJSON(value['team1']),
        'team2': ViewMatchTeamToJSON(value['team2']),
    };
}
