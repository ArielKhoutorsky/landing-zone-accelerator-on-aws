/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

/**
 * aws-controltower-create-accounts - lambda handler
 *
 * @param event
 * @returns
 */
import { CloudFormationCustomResourceEvent } from '@aws-accelerator/utils/lib/common-types';

interface OptInRegionsProps {
  accountIds: string[];
  homeRegion: string;
  enabledRegions: string[];
  managementAccountAccessRole: string;
  partition: string;
}

export async function handler(event: CloudFormationCustomResourceEvent): Promise<
  | {
      IsComplete: boolean;
      Status: string;
      Reason?: string;
      Props?: OptInRegionsProps;
    }
  | undefined
> {
  switch (event.RequestType) {
    case 'Create':
    case 'Update':
      return {
        IsComplete: false,
        Status: 'SUCCESS',
        Props: event.ResourceProperties['props'],
      };

    case 'Delete':
      // Do Nothing
      return {
        IsComplete: true,
        Status: 'SUCCESS',
      };
  }
}
