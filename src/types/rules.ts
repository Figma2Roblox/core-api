/// <reference types="@figma/plugin-typings/plugin-api" />

import { CreatableInstances } from "@figma2rbx/rbx-ui";
import { Component } from "./component";

type RuleProperties = { [key: string]: any };

interface RuleRejected {
	result: "Rejected";
	reason: string;
	offendingNodes: SceneNode[];
	fix?: () => void;
}

interface RuleContinued {
	result: "Continued";
	properties: RuleProperties;
}

interface RuleCompleted {
	result: "Completed";
}

interface InstanceDefined extends RuleCompleted {
	instance: CreatableInstances[keyof CreatableInstances];
	component?: never;
}

interface ComponentDefined extends RuleCompleted {
	component: Component;
	instance?: never;
}

type ElementRuleCompleted = InstanceDefined | ComponentDefined;

export const signatureSymbol: unique symbol = Symbol("Rule Signature");
export interface RuleSignature {
	name: string;
	signatureId: string;
	symbol: typeof signatureSymbol;
	appearanceGroup?: string;
}

// Utility types to enforce at least 2 enum members
type DictionaryEntry<Key extends PropertyKey, Value> = {
	[P in Key]: Value;
};
type AtLeastTwoEntries<K extends PropertyKey, V> = [
	DictionaryEntry<K, V>,
	DictionaryEntry<K, V>,
	...Array<DictionaryEntry<K, V>>,
];
type DictionaryWithAtLeastTwoEntries<Key extends PropertyKey, Value> = AtLeastTwoEntries<Key, Value>[number];
interface EnumRuleOption {
	type: "enum";
	description: string;
	members: DictionaryWithAtLeastTwoEntries<string, string>;
}

interface BoolRuleOption {
	type: "bool";
	description: string;
	trueExplanation: string;
	falseExplanation: string;
	defaultValue: boolean;
}

type RuleOptions = { [key: string]: EnumRuleOption | BoolRuleOption };

type BaseRuleConfig = {
	name: string;
	description: string;
	options?: RuleOptions;
	evaluateAfter?: RuleSignature[];
	evaluateBefore?: RuleSignature[];
};

// Use union types to ensure that at least one of the canReject, canContinue, or canComplete properties are true
type BaseConfigWithAtLeastRejectSetTrue = BaseRuleConfig & {
	canReject: true;
	canContinue?: boolean;
	canComplete?: boolean;
};
type BaseConfigWithAtLeastContinueSetTrue = BaseRuleConfig & {
	canReject?: boolean;
	canContinue: true;
	canComplete?: boolean;
};
type BaseConfigWithAtLeastCompleteSetTrue = BaseRuleConfig & {
	canReject?: boolean;
	canContinue?: boolean;
	canComplete: true;
};

export type RuleConfig =
	| BaseConfigWithAtLeastRejectSetTrue
	| BaseConfigWithAtLeastContinueSetTrue
	| BaseConfigWithAtLeastCompleteSetTrue;

// Generic to extract the options interface based on the provided config. This
// will be used to enforce that the options object passed to the evaluator
// function is correctly typed based on the provided config, which is a nice
// ergonomics feature.
export type GetOptionsInterface<Options extends RuleOptions> = {
	[key in keyof Options]: Options[key] extends EnumRuleOption ? keyof Options[key]["members"] : boolean;
};

// Generics used to enforce that the evaluator function returns the correct type
// based on the provided config, which is a nice ergonomics feature.
type GetBaseRuleReturnType<Config extends RuleConfig> =
	| (Config["canContinue"] extends true ? true : never)
	| (Config["canReject"] extends true ? true : never)
	| (Config["canComplete"] extends true ? true : never);

export type GetElementRuleReturnType<Config extends RuleConfig> =
	| (Config["canComplete"] extends true ? ElementRuleCompleted : never)
	| GetBaseRuleReturnType<Config>;

export type GetAppearanceRuleReturnType<Config extends RuleConfig> =
	| (Config["canComplete"] extends true ? RuleCompleted : never)
	| GetBaseRuleReturnType<Config>;

// Generic type to type the evluator function based on the provided config.
export type TypeEvaluator<Config extends RuleConfig, ReturnType> = Config["options"] extends {}
	? (node: SceneNode, properties: RuleProperties, options: GetOptionsInterface<Config["options"]>) => ReturnType
	: (node: SceneNode, properties: RuleProperties) => ReturnType;
