import { GetApperanceRuleReturnType, GetElementRuleReturnType, RuleConfig, RuleSignature, signatureSymbol, TypeEvaluator } from "./types/rules"

function upperFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

type InternalRule = {
	ruleType: "element" | "appearance",
	name: string,
	evaluator: (...args: any[]) => any,
	after?: string[],
	before?: string[],
}

const anyRuleBySignature: { [key: string]: InternalRule } = {}
const elementRuleBySignature: { [key: string]: InternalRule } = {}
const appearanceRuleGroups: { [key: string]: {[key: string]: InternalRule} } = {}

function createRuleSingature(name: string, appearanceGroup?: string): RuleSignature {
	return {
		name: name,
		symbol: signatureSymbol,
		signatureId: crypto.randomUUID(),
		appearanceGroup: appearanceGroup,
	}
}

function checkDependencies(errorVerb: string, ruleType: "element" | "appearance", thisRuleName: string, dependencies: RuleSignature[]) {
	const otherType = ruleType === "element" ? "appearance" : "element"

	for (const signature of dependencies) {
		const rule = elementRuleBySignature[signature.signatureId]
		const errorPrefix = `${upperFirst(ruleType)} rule '${thisRuleName}' cannot be evaluated ${errorVerb} rule '${signature.name}': `

		if (rule === undefined) {
			throw new Error(errorPrefix + `'${signature.name}' does not exist. (It's possible these rules are not using the same core-api module. Check to make sure your peerDependencies in package.json is configured correctly.)`)
		} else if (rule.ruleType !== ruleType) {
			throw new Error(errorPrefix + `'${signature.name}' is an ${otherType} rule. ${upperFirst(ruleType)} rules can only be evaluated ${errorVerb} other ${ruleType} rules.`)
		}
	}
}
 
function AddElementRule<Config extends RuleConfig>(
	config: Config,
	evaluator: TypeEvaluator<Config, GetElementRuleReturnType<Config>>
): RuleSignature {
	if ("evaluateAfter" in config && config.evaluateAfter !== undefined) {
		checkDependencies("after", "element", config.name, config.evaluateAfter)
	} else if ("evaluateBefore" in config && config.evaluateBefore !== undefined) {
		checkDependencies("before", "element", config.name, config.evaluateBefore)
	}

	const signature = createRuleSingature(config.name)
	const internalRule: InternalRule = {
		name: config.name,
		ruleType: "element",
		after: config.evaluateAfter?.map(sig => sig.signatureId),
		before: config.evaluateBefore?.map(sig => sig.signatureId),
		evaluator: evaluator
	}

	anyRuleBySignature[signature.signatureId] = internalRule
	elementRuleBySignature[signature.signatureId] = internalRule
	
	return signature
}

function checkGroupDependencies(errorVerb: string, thisRuleName: string, thisRuleGroup: string, dependencies: RuleSignature[]) {
	for (const signature of dependencies) {
		if (signature.appearanceGroup !== thisRuleGroup) {
			throw new Error(`Appearance rule '${thisRuleName}' cannot be evaluated after rule '${signature.name}': '${thisRuleName}' belongs to appearance group '${thisRuleGroup}', while '${signature.name}' belongs to appearance group '${signature.appearanceGroup}'`)
		}
	}
}

function AddAppearanceRule<Config extends RuleConfig>(
	groupName: string,
	config: Config,
	evaluator: TypeEvaluator<Config, GetApperanceRuleReturnType<Config>>
): RuleSignature {
	if (!(groupName in appearanceRuleGroups)) {
		appearanceRuleGroups[groupName] = {}
	}
	const appearanceRuleBySignature = appearanceRuleGroups[groupName]

	if ("evaluateAfter" in config && config.evaluateAfter !== undefined) {
		checkDependencies("after", "appearance", config.name, config.evaluateAfter)
		checkGroupDependencies("after", config.name, groupName, config.evaluateAfter)
	} else if ("evaluateBefore" in config && config.evaluateBefore !== undefined) {
		checkDependencies("before", "appearance", config.name, config.evaluateBefore)
		checkGroupDependencies("before", config.name, groupName, config.evaluateBefore)
	}

	const signature = createRuleSingature(config.name, groupName)
	const internalRule: InternalRule = {
		name: config.name,
		ruleType: "appearance",
		after: config.evaluateAfter?.map(sig => sig.signatureId),
		before: config.evaluateBefore?.map(sig => sig.signatureId),
		evaluator: evaluator
	}

	anyRuleBySignature[signature.signatureId] = internalRule
	elementRuleBySignature[signature.signatureId] = internalRule

	return signature
}