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

export type RuleResult = RuleRejected | RuleContinued | ElementRuleCompleted;

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

export type RuleConfig = {
	name: string;
	description: string;
	options?: RuleOptions;
	evaluateAfter?: RuleSignature[];
	evaluateBefore?: RuleSignature[];
};

// Generic to extract the options interface based on the provided config. This
// will be used to enforce that the options object passed to the evaluator
// function is correctly typed based on the provided config, which is a nice
// ergonomics feature.
export type GetOptionsInterface<Options extends RuleOptions> = {
	[key in keyof Options]: Options[key] extends EnumRuleOption ? keyof Options[key]["members"] : boolean;
};

export type GetEvaluatorSignature<Config extends RuleConfig> = Config["options"] extends {}
	? (node: SceneNode, properties: RuleProperties, options: GetOptionsInterface<Config["options"]>) => RuleResult
	: (node: SceneNode, properties: RuleProperties) => RuleResult;
