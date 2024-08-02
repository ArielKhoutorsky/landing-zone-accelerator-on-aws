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
 * aws-opt-in-regions - lambda handler
 *
 * @param event
 * @returns
 */
import { CloudFormationCustomResourceEvent } from '@aws-accelerator/utils/lib/common-types';
import { setStsTokenPreferences } from '@aws-accelerator/utils/lib/set-token-preferences';

export async function handler(event: CloudFormationCustomResourceEvent): Promise<
  | {
      IsComplete: boolean;
    }
  | undefined
> {
  switch (event.RequestType) {
    case 'Create':
    case 'Update':
      const { accountIds, globalRegion } = event.ResourceProperties['props'] as {
        accountIds: string[];
        globalRegion: string;
      };
      await Promise.all(accountIds.map(accountId => setStsTokenPreferences(accountId, globalRegion)));
      return {
        IsComplete: false,
      };

    case 'Delete':
      // Do Nothing
      return {
        IsComplete: true,
      };
  }
}
