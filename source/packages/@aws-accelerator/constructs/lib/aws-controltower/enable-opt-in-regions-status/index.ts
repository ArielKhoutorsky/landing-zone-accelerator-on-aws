/**
 * aws-controltower-opt-in-regions - lambda handler
 *
 * @param event
 * @returns
 */
import { CloudFormationCustomResourceEvent } from '@aws-accelerator/utils/lib/common-types';
import { getCrossAccountCredentials } from '@aws-accelerator/utils/lib/common-functions';
import { AccountClient, GetRegionOptStatusCommand, EnableRegionCommand } from '@aws-sdk/client-account';
import { OptInRegions } from '@aws-accelerator/utils/lib/regions';
import { throttlingBackOff } from '@aws-accelerator/utils/lib/throttle';

interface OptInRegionsProps {
  managementAccountId: string;
  accountIds: string[];
  homeRegion: string;
  enabledRegions: string[];
  managementAccountAccessRole: string;
  partition: string;
}

export async function handler(event: CloudFormationCustomResourceEvent): Promise<
  | {
      IsComplete: boolean;
    }
  | undefined
> {
  const props = event.ResourceProperties['props'];

  // Perform operation to check completion
  const IsComplete = await processAllAccountsRegions(props);

  return {
    IsComplete,
  };
}

async function processAllAccountsRegions(props: OptInRegionsProps) {
  const promises = [];
  for (const accountId of props.accountIds) {
    for (const enabledRegion of props.enabledRegions) {
      if (OptInRegions.includes(enabledRegion) && accountId !== props.managementAccountId) {
        const crossAccountCredentials = await throttlingBackOff(() =>
          getCrossAccountCredentials(accountId, props.homeRegion, props.partition, props.managementAccountAccessRole),
        );
        const credentials = {
          accessKeyId: crossAccountCredentials.Credentials!.AccessKeyId!,
          secretAccessKey: crossAccountCredentials.Credentials!.SecretAccessKey!,
          sessionToken: crossAccountCredentials.Credentials!.SessionToken!,
        };
        promises.push(processAccountRegion(accountId, props.homeRegion, enabledRegion, credentials));
      }
    }
  }
  const results = await Promise.all(promises);
  return results.every(state => state.isComplete);
}

async function processAccountRegion(
  accountId: string,
  homeRegion: string,
  optinRegion: string,
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  },
) {
  const accountClient = new AccountClient({ credentials, region: homeRegion }) as AccountClient;
  try {
    const optStatus = await checkRegionOptStatus(accountClient, optinRegion);
    console.log(`Current opt status for region ${optinRegion} for account id ${accountId}: ${optStatus}`);
    if (optStatus === 'DISABLED') {
      console.log(`Opt-in initialized for ${optinRegion} for account id ${accountId}`);
      await optInRegion(accountClient, optinRegion);
      return { accountId, isComplete: false };
    } else if (optStatus === 'ENABLING' || optStatus === 'DISABLING') {
      console.log(`Opt-in in progress for ${optinRegion} for account id ${accountId}`);
      return { accountId, isComplete: false };
    } else {
      console.log(`Opt-in in complete for ${optinRegion} for account id ${accountId}`);
      return { accountId, isComplete: true };
    }
  } catch (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    e: any
  ) {
    console.log(`Error processing account id ${accountId}: ${e.message}`);
    return { accountId, isComplete: false };
  }
}

async function checkRegionOptStatus(client: AccountClient, optinRegion: string): Promise<string | undefined> {
  try {
    const command = new GetRegionOptStatusCommand({ RegionName: optinRegion });
    const response = await throttlingBackOff(() => client.send(command));
    return response.RegionOptStatus;
  } catch (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    e: any
  ) {
    console.log(`Error checking region opt status: ${e.message}`);
    throw e;
  }
}

async function optInRegion(client: AccountClient, optinRegion: string): Promise<void> {
  try {
    const command = new EnableRegionCommand({ RegionName: optinRegion });
    await throttlingBackOff(() => client.send(command));
  } catch (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    e: any
  ) {
    console.log(`Error opting in to region ${optinRegion}: ${e.message}`);
    throw e;
  }
}
