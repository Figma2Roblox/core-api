import {
	AppearanceEvaluator,
	AppearanceRuleConfig,
	ElementEvaluator,
	ElementRuleConfig,
	RuleSignature,
	signatureSymbol,
} from "./typesApi";

type RuleConfig = ElementRuleConfig | AppearanceRuleConfig;

function upperFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

type InternalRule = {
	ruleType: "element" | "appearance";
	name: string;
	evaluator: (...args: any[]) => any;
	signatureId: string;
	dependencies: Set<string>;
	propertyDependencies: Set<string>;
	appearanceGroup?: string;
};

export const anyRuleBySignature: { [key: string]: InternalRule } = {};
export const elementRuleBySignature: { [key: string]: InternalRule } = {};
export const appearanceRuleGroups: { [key: string]: { [key: string]: InternalRule } } = {};

function createRuleSingature(name: string, appearanceGroup?: string): RuleSignature {
	return {
		name: name,
		symbol: signatureSymbol,
		signatureId: crypto.randomUUID(),
	};
}

function checkDependencyArray(
	errorVerb: string,
	ruleType: "element" | "appearance",
	thisRuleName: string,
	dependencies: RuleSignature[],
) {
	const otherType = ruleType === "element" ? "appearance" : "element";

	for (const signature of dependencies) {
		const rule = anyRuleBySignature[signature.signatureId];
		const errorPrefix = `${upperFirst(ruleType)} rule '${thisRuleName}' cannot be evaluated ${errorVerb} rule '${signature.name}': `;

		if (rule === undefined) {
			throw new Error(
				errorPrefix +
					`'${signature.name}' does not exist. (It's possible these rules are not using the same core-api module. Check to make sure your peerDependencies in package.json is configured correctly.)`,
			);
		} else if (rule.ruleType !== ruleType) {
			throw new Error(
				errorPrefix +
					`'${signature.name}' is an ${otherType} rule. ${upperFirst(ruleType)} rules can only be evaluated ${errorVerb} other ${ruleType} rules.`,
			);
		}
	}
}

function assertDependencies(config: RuleConfig, ruleType: "element" | "appearance") {
	if (config.evaluatesAfter) {
		checkDependencyArray("after", ruleType, config.name, config.evaluatesAfter);
	}
	if (config.evaluatesBefore) {
		checkDependencyArray("before", ruleType, config.name, config.evaluatesBefore);
	}
}

function checkGroupDependency(
	thisRuleName: string,
	thisRuleGroup: string,
	dependencies: RuleSignature[],
	errorVerb: string,
) {
	dependencies.forEach(otherRuleSignature => {
		const otherRule = anyRuleBySignature[otherRuleSignature.signatureId];
		if (otherRule.appearanceGroup !== thisRuleGroup) {
			throw new Error(
				`Appearance rule '${thisRuleName}' cannot be evaluated ${errorVerb} rule '${otherRule.name}': '${thisRuleName}' belongs to appearance group '${thisRuleGroup}', while '${otherRule.name}' belongs to appearance group '${otherRule.appearanceGroup}'`,
			);
		}
	});
}

function assertSameGroupAsDependencies(config: AppearanceRuleConfig, thisRuleGroup: string) {
	if (config.evaluatesAfter) {
		checkGroupDependency(config.name, thisRuleGroup, config.evaluatesAfter, "after");
	}
	if (config.evaluatesBefore) {
		checkGroupDependency(config.name, thisRuleGroup, config.evaluatesBefore, "before");
	}
}

function getMyDependenciesAndUpdateOthers(config: RuleConfig, thisSignature: RuleSignature) {
	const thisRulePropertyDependencies: Set<string> = new Set();
	const thisRuleDependencies: Set<string> = new Set();

	config.getsPropertiesFrom?.forEach(otherRuleSignature => {
		thisRuleDependencies.add(otherRuleSignature.signatureId);
		thisRulePropertyDependencies.add(otherRuleSignature.signatureId);
	});

	config.evaluatesAfter?.forEach(otherRuleSignature => {
		thisRuleDependencies.add(otherRuleSignature.signatureId);
	});

	// Update rules that this rule must be evaluated before to include this rule
	// as a dependency. This makes the topological sorting of the rules by
	// evaluation & property dependency easier.
	config.evaluatesBefore?.forEach(otherRuleSignature => {
		if (thisRuleDependencies.has(otherRuleSignature.signatureId)) {
			throw new Error(
				`Rule '${config.name}' cannot be evaluated before and after rule '${otherRuleSignature.name}'`,
			);
		}

		const otherRule = anyRuleBySignature[otherRuleSignature.signatureId];
		otherRule.dependencies.add(thisSignature.signatureId);
	});

	return [thisRuleDependencies, thisRulePropertyDependencies];
}

function hasCircularDependency(ruleId: string, visited: Set<string>, stack: Set<string>): boolean {
	if (stack.has(ruleId)) {
		return true; // Cycle detected
	}

	if (visited.has(ruleId)) {
		return false; // Already visited, no cycle from this node
	}

	visited.add(ruleId);
	stack.add(ruleId);

	const evaluationDepedencySet = anyRuleBySignature[ruleId].dependencies;

	for (const dependencyId of evaluationDepedencySet || []) {
		if (hasCircularDependency(dependencyId, visited, stack)) {
			return true;
		}
	}

	stack.delete(ruleId); // Backtrack
	return false;
}

export function addElementRule<Config extends ElementRuleConfig>(
	config: Config,
	evaluator: ElementEvaluator<Config>,
): RuleSignature {
	assertDependencies(config, "element");

	const signature = createRuleSingature(config.name);
	const [dependencies, propertyDependencies] = getMyDependenciesAndUpdateOthers(config, signature);
	const internalRule: InternalRule = {
		name: config.name,
		ruleType: "element",
		evaluator: evaluator,
		signatureId: signature.signatureId,
		dependencies: dependencies,
		propertyDependencies: propertyDependencies,
	};

	anyRuleBySignature[signature.signatureId] = internalRule;
	elementRuleBySignature[signature.signatureId] = internalRule;

	return signature;
}

export function addAppearanceRule<Config extends AppearanceRuleConfig>(
	groupName: string,
	config: Config,
	evaluator: AppearanceEvaluator<Config>,
): RuleSignature {
	assertDependencies(config, "appearance");
	assertSameGroupAsDependencies(config, groupName);

	const signature = createRuleSingature(config.name, groupName);
	const [dependencies, propertyDependencies] = getMyDependenciesAndUpdateOthers(config, signature);

	const internalRule: InternalRule = {
		name: config.name,
		ruleType: "appearance",
		evaluator: evaluator,
		signatureId: signature.signatureId,
		dependencies: dependencies,
		propertyDependencies: propertyDependencies,
	};

	anyRuleBySignature[signature.signatureId] = internalRule;

	if (!appearanceRuleGroups[groupName]) {
		appearanceRuleGroups[groupName] = {};
	}
	const appearanceRuleBySignature = appearanceRuleGroups[groupName];
	appearanceRuleBySignature[signature.signatureId] = internalRule;

	return signature;
}

export function orderRulesByDependencies(unorderedRules: InternalRule[]): InternalRule[] {
	// Check for circular dependencies
	const visited = new Set<string>();
	const stack = new Set<string>();
	for (const rule of unorderedRules) {
		if (hasCircularDependency(rule.signatureId, visited, stack)) {
			let cycleString = "";
			let hasStarted = false;
			for (const ruleId of stack) {
				if (rule.signatureId === ruleId && !hasStarted) {
					hasStarted = true;
				}
				if (hasStarted) {
					cycleString += `'${anyRuleBySignature[ruleId]?.name}' after -> `;
				}
			}
			cycleString += `'${rule.name}'`;

			throw new Error(`Circular dependency detected: [${cycleString}]`);
		}
	}

	const orderedRules: InternalRule[] = [];
	const ruleVisitedById: { [key: string]: true } = {};

	// DFS Topological sort
	while (orderedRules.length < unorderedRules.length) {
		for (const rule of unorderedRules) {
			if (ruleVisitedById[rule.signatureId]) {
				continue;
			}

			let dependenciesOrdered = true;

			if (rule.dependencies) {
				for (const dependencyId of rule.dependencies) {
					if (!ruleVisitedById[dependencyId]) {
						dependenciesOrdered = false;
						break;
					}
				}
			}

			if (dependenciesOrdered) {
				ruleVisitedById[rule.signatureId] = true;
				orderedRules.push(rule);
				break;
			}
		}
	}

	return orderedRules;
}

module.exports = {
	anyRuleBySignature: anyRuleBySignature,
	elementRuleBySignature: elementRuleBySignature,
	appearanceRuleGroups: appearanceRuleGroups,
	addAppearanceRule: addAppearanceRule,
	addElementRule: addElementRule,
	orderRulesByDependencies: orderRulesByDependencies,
};

export default module.exports;
