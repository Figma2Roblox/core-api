/// <reference types="@figma/plugin-typings/plugin-api" />

import {
	Color3,
	ColorSequence,
	CreatableInstances,
	Font,
	NumberSequence,
	Rect,
	UDim,
	UDim2,
	Vector2,
} from "@figma2rbx/rbx-ui";

type UserData = UDim | UDim2 | Vector2 | Color3 | ColorSequence | NumberSequence | Font | Rect;
type Primitive = string | number | boolean;

export type ComponentProperty = UserData | Primitive | CreatableInstances | Component;

export type CustomComponent = {
	moduleName: string;
	modulePath?: string[];
};

export type Component = {
	name: string;
	source: ComponentNode | CustomComponent;
	children: (Component | CreatableInstances[keyof CreatableInstances])[];
	properties: ComponentProperties;
};

export type Element = {
	name: string;
	children: Element[];
	instance: CreatableInstances[keyof CreatableInstances];
};

type RuleSignatureId = string;
type RuleProperties = { [key: RuleSignatureId]: { [key: string]: any } };

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
type EnumName = string;
type EnumExplanation = string;

interface EnumRuleOption {
	type: "enum";
	description: string;
	members: DictionaryWithAtLeastTwoEntries<EnumName, EnumExplanation>;
}

interface BoolRuleOption {
	type: "bool";
	description: string;
	trueExplanation: string;
	falseExplanation: string;
	defaultValue: boolean;
}

type RuleOptions = { [key: string]: EnumRuleOption | BoolRuleOption };

export interface ElementRuleConfig {
	readonly name: string;
	readonly description: string;
	readonly options?: RuleOptions;
	readonly getsPropertiesFrom?: RuleSignature[];
	readonly evaluatesAfter?: RuleSignature[];
	readonly evaluatesBefore?: RuleSignature[];
}

export interface AppearanceRuleConfig extends ElementRuleConfig {
	readonly elementType: "instance" | "component" | "any";
}

// Generic to extract the options interface based on the provided config. This
// will be used to enforce that the options object passed to the evaluator
// function is correctly typed based on the provided config, which is a nice
// ergonomics feature.
type GetOptionsInterface<Options extends RuleOptions> = {
	[key in keyof Options]: Options[key] extends EnumRuleOption ? keyof Options[key]["members"] : boolean;
};

type GetElementType<Config extends AppearanceRuleConfig> = Config["elementType"] extends "instance"
	? CreatableInstances[keyof CreatableInstances]
	: Config["elementType"] extends "component"
		? Component
		: Config["elementType"] extends "any"
			? CreatableInstances[keyof CreatableInstances] | Component
			: never;

type ElementRuleResult = RuleRejected | RuleContinued | ElementRuleCompleted;
export type ElementEvaluator<Config extends ElementRuleConfig> = Config["options"] extends {}
	? (
			node: SceneNode,
			properties: RuleProperties,
			options: GetOptionsInterface<Config["options"]>,
		) => ElementRuleResult
	: (node: SceneNode, properties: RuleProperties, options: {}) => ElementRuleResult;

type AppearanceResult = RuleRejected | RuleContinued | RuleCompleted;
export type AppearanceEvaluator<Config extends AppearanceRuleConfig> = Config["options"] extends {}
	? (
			node: SceneNode,
			element: GetElementType<Config>,
			properties: RuleProperties,
			options: GetOptionsInterface<Config["options"]>,
		) => AppearanceResult
	: (node: SceneNode, element: GetElementType<Config>, properties: RuleProperties, options: {}) => AppearanceResult;
