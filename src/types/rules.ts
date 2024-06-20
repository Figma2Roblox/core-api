import { CreatableInstances } from "@figma2rbx/rbx-ui"
import { Component } from "./component"

export type RuleProperties = { [key: string]: any }

export interface RuleRejected {
	result: "Rejected"
	reason: string
	offendingNodes: SceneNode[]
	fix?: () => void
}

export interface RuleContinued {
	result: "Continued"
	properties: RuleProperties
}

export interface RuleCompleted {
	result: "Completed"
}

interface InstanceDefined extends RuleCompleted {
	instance: CreatableInstances[keyof CreatableInstances];
	component?: never
}

interface ComponentDefined extends RuleCompleted {
	component: Component
	instance?: never
}

export type ElementRuleCompleted = InstanceDefined | ComponentDefined;

// export type ElementRuleEvaluation = ElementRuleCompleted | RuleContinued | RuleRejected;
// export type AppearanceRuleEvaluation = RuleCompleted | RuleContinued | RuleRejected;

type EnumRuleOptionMember = {
	name: string,
	explanation: string,
}

export interface EnumRuleOption {
	type: "enum",
	description: string,
	members: [EnumRuleOptionMember, EnumRuleOptionMember, ...EnumRuleOptionMember[]]
};

export interface BoolRuleOption {
	type: "bool",
	description: string,
	defaultValue: boolean,
}

type RuleOptions = { [key: string]: EnumRuleOption | BoolRuleOption };

export const signatureSymbol: unique symbol = Symbol("Rule Signature")
export interface RuleSignature {
	name: string,
	signatureId: string,
	symbol: typeof signatureSymbol,
	appearanceGroup?: string,
}

type BaseRuleConfig = {
	name: string;
	description: string;
	options?: RuleOptions;
	evaluateAfter?: RuleSignature[];
	evaluateBefore?: RuleSignature[];
}

// Use union types to ensure that at least one of the canReject, canContinue, or canComplete properties are true
type BaseConfigWithAtLeastRejectSetTrue = BaseRuleConfig & { canReject: true, canContinue?: boolean, canComplete?: boolean };
type BaseConfigWithAtLeastContinueSetTrue = BaseRuleConfig & { canReject?: boolean, canContinue: true, canComplete?: boolean };
type BaseConfigWithAtLeastCompleteSetTrue = BaseRuleConfig & { canReject?: boolean, canContinue?: boolean, canComplete: true };

export type RuleConfig = BaseConfigWithAtLeastRejectSetTrue | BaseConfigWithAtLeastContinueSetTrue | BaseConfigWithAtLeastCompleteSetTrue;

// Generics to extract the options interface based on the provided config. This
// will be used to enforce that the options object passed to the evaluator
// function is correctly typed based on the provided config, which is a nice
// ergonomics feature.
type GetOptionsInterface<Options extends RuleConfig['options']> = {
	[key in keyof Options]: Options[key] extends EnumRuleOption ? keyof Options[key]["members"] : boolean
}

// Generic type to type the evluator function based on the provided config.
export type TypeEvaluator<Config extends RuleConfig, ReturnType> = Config['options'] extends {}
	? (node: SceneNode, properties: RuleProperties, options: GetOptionsInterface<Config['options']>) => ReturnType
	: (node: SceneNode, properties: RuleProperties) => ReturnType

// Generics used to enforce that the evaluator function returns the correct type
// based on the provided config, which is a nice ergonomics feature.
type GetBaseRuleReturnType<Config extends RuleConfig> = Config["canContinue"] extends true ? RuleContinued : never | Config["canReject"] extends true ? RuleRejected : never
export type GetElementRuleReturnType<Config extends RuleConfig> = Config["canComplete"] extends true ? ElementRuleCompleted : never | GetBaseRuleReturnType<Config>
export type GetApperanceRuleReturnType<Config extends RuleConfig> = Config["canComplete"] extends true ? RuleCompleted : never | GetBaseRuleReturnType<Config>

