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

import * as cdk from 'aws-cdk-lib';
import { v4 as uuidv4 } from 'uuid';
import { Construct } from 'constructs';
import path = require('path');

/**
 * Opt-in Regions Props
 */
export interface OptInRegionsProps {
  /**
   * Custom resource lambda log group encryption key, when undefined default AWS managed key will be used
   */
  readonly kmsKey?: cdk.aws_kms.IKey;
  /**
   * Custom resource lambda log retention in days
   */
  readonly logRetentionInDays: number;
  /**
   * Custom resource lambda log account ids
   */
  readonly accountIds: string[];
  /**
   * Custom resource lambda home region
   */
  homeRegion: string;
  /**
   * Custom resource lambda enabled regions
   */
  enabledRegions: string[];
  /**
   * Custom resource lambda management account access role
   */
  managementAccountAccessRole: string;
  /**
   * Custom resource lambda AWS partition
   */
  readonly partition: string;
}

/**
 * Class Opt-in Regions
 */
export class OptInRegions extends Construct {
  readonly onEvent: cdk.aws_lambda.IFunction;
  readonly isComplete: cdk.aws_lambda.IFunction;
  readonly provider: cdk.custom_resources.Provider;
  readonly id: string;

  constructor(scope: Construct, id: string, props: OptInRegionsProps) {
    super(scope, id);

    const OPT_IN_REGIONS = 'Custom::OptInRegions';

    this.onEvent = new cdk.aws_lambda.Function(this, 'OptInRegionsOnEvent', {
      code: cdk.aws_lambda.Code.fromAsset(path.join(__dirname, 'enable-opt-in-regions/dist')),
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(1),
      description: 'Opt-in Regions onEvent handler',
      environmentEncryption: props.kmsKey,
    });

    new cdk.aws_logs.LogGroup(this, `${this.onEvent.node.id}LogGroup`, {
      logGroupName: `/aws/lambda/${this.onEvent.functionName}`,
      retention: props.logRetentionInDays,
      encryptionKey: props.kmsKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const iamPolicy = new cdk.aws_iam.PolicyStatement({
      sid: 'IAMPolicy',
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['account:ListRegions', 'account:EnableRegion', 'account:GetRegionOptStatus'],
      resources: ['*'],
    });

    this.isComplete = new cdk.aws_lambda.Function(this, 'OptInRegionsIsComplete', {
      code: cdk.aws_lambda.Code.fromAsset(path.join(__dirname, 'enable-opt-in-regions-status/dist')),
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      description: 'Opt-in Regions isComplete handler',
      environmentEncryption: props.kmsKey,
      initialPolicy: [iamPolicy],
    });

    new cdk.aws_logs.LogGroup(this, `${this.isComplete.node.id}LogGroup`, {
      logGroupName: `/aws/lambda/${this.isComplete.functionName}`,
      retention: props.logRetentionInDays,
      encryptionKey: props.kmsKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.provider = new cdk.custom_resources.Provider(this, 'OptInRegionsProvider', {
      onEventHandler: this.onEvent,
      isCompleteHandler: this.isComplete,
      queryInterval: cdk.Duration.seconds(300),
      totalTimeout: cdk.Duration.hours(4),
    });

    const resource = new cdk.CustomResource(this, 'Resource', {
      resourceType: OPT_IN_REGIONS,
      serviceToken: this.provider.serviceToken,
      properties: {
        uuid: uuidv4(),
        props: {
          accountIds: props.accountIds,
          homeRegion: props.homeRegion,
          enabledRegions: props.enabledRegions,
          managementAccountAccessRole: props.managementAccountAccessRole,
          partition: props.partition,
        },
      },
    });

    this.id = resource.ref;
  }
}
