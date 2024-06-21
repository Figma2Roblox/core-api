import { RuleConfig, RuleSignature, signatureSymbol, GetEvaluatorSignature } from "./types/rules";

function upperFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

type InternalRule = {
	ruleType: "element" | "appearance";
	name: string;
	evaluator: (...args: any[]) => any;
	signatureId: string;
	dependencies?: Set<string>;
};

export const anyRuleBySignature: { [key: string]: InternalRule } = {};
export const elementRuleBySignature: { [key: string]: InternalRule } = {};
export const appearanceRuleGroups: { [key: string]: { [key: string]: InternalRule } } = {};

function createRuleSingature(name: string, appearanceGroup?: string): RuleSignature {
	return {
		name: name,
		symbol: signatureSymbol,
		signatureId: crypto.randomUUID(),
		appearanceGroup: appearanceGroup,
	};
}

function simpleCheckDependenices(
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

function checkGroupDependencies(
	errorVerb: string,
	thisRuleName: string,
	thisRuleGroup: string,
	dependencies: RuleSignature[],
) {
	for (const signature of dependencies) {
		if (signature.appearanceGroup !== thisRuleGroup) {
			throw new Error(
				`Appearance rule '${thisRuleName}' cannot be evaluated ${errorVerb} rule '${signature.name}': '${thisRuleName}' belongs to appearance group '${thisRuleGroup}', while '${signature.name}' belongs to appearance group '${signature.appearanceGroup}'`,
			);
		}
	}
}

function processDependencies(config: RuleConfig, ruleType: "element" | "appearance", signature: RuleSignature) {
	const dependencies: Set<string> | undefined = config.evaluateAfter
		? new Set(config.evaluateAfter?.map(sig => sig.signatureId))
		: undefined;

	config.evaluateBefore?.forEach(dependentSig => {
		if (dependencies?.has(dependentSig.signatureId)) {
			throw new Error(
				`${upperFirst(ruleType)} rule '${config.name}' cannot be evaluated before and after rule '${dependentSig.name}'`,
			);
		}

		const dependentRule = anyRuleBySignature[dependentSig.signatureId];
		if (!dependentRule.dependencies) {
			dependentRule.dependencies = new Set([signature.signatureId]);
		} else if (!dependentRule.dependencies.has(signature.signatureId)) {
			dependentRule.dependencies.add(signature.signatureId);
		}
	});

	return dependencies;
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

export function addElementRule<Config extends RuleConfig>(
	config: Config,
	evaluator: GetEvaluatorSignature<Config>,
): RuleSignature {
	if ("evaluateAfter" in config && config.evaluateAfter) {
		simpleCheckDependenices("after", "element", (config as Config).name, config.evaluateAfter);
	} else if ("evaluateBefore" in config && config.evaluateBefore !== undefined) {
		simpleCheckDependenices("before", "element", config.name, config.evaluateBefore);
	}

	const signature = createRuleSingature(config.name);
	const internalRule: InternalRule = {
		name: config.name,
		ruleType: "element",
		evaluator: evaluator,
		signatureId: signature.signatureId,
		dependencies: processDependencies(config, "element", signature),
	};

	anyRuleBySignature[signature.signatureId] = internalRule;
	elementRuleBySignature[signature.signatureId] = internalRule;

	return signature;
}

export function addAppearanceRule<Config extends RuleConfig>(
	groupName: string,
	config: Config,
	evaluator: GetEvaluatorSignature<Config>,
): RuleSignature {
	if ("evaluateAfter" in config && config.evaluateAfter !== undefined) {
		simpleCheckDependenices("after", "appearance", config.name, config.evaluateAfter);
		checkGroupDependencies("after", config.name, groupName, config.evaluateAfter);
	} else if ("evaluateBefore" in config && config.evaluateBefore !== undefined) {
		simpleCheckDependenices("before", "appearance", config.name, config.evaluateBefore);
		checkGroupDependencies("before", config.name, groupName, config.evaluateBefore);
	}

	const signature = createRuleSingature(config.name, groupName);
	const internalRule: InternalRule = {
		name: config.name,
		ruleType: "appearance",
		evaluator: evaluator,
		signatureId: signature.signatureId,
		dependencies: processDependencies(config, "appearance", signature),
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
				// Once this rule is ordered we want to start from the beginning to order rules that have a dependency on this rule
				break;
			}
		}
	}

	console.log("Done sorting");

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
