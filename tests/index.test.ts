import { expect, jest, test } from "@jest/globals";
import { Instance } from "@figma2rbx/rbx-ui";
const coreApi = require("../src") as typeof import("../src");

describe("rule API:", () => {
	const genericResult = {
		result: "Completed",
		instance: Instance.new("Frame"),
	} as const;

	function getConfig(name: string) {
		return {
			name: name,
			description: name,
			canComplete: true as true,
		};
	}

	test("errors if dependency is in another group", () => {
		const aSig = coreApi.addAppearanceRule("group1", getConfig("a"), (node, properties) => {
			return genericResult;
		});

		expect(() => {
			coreApi.addAppearanceRule("group2", { ...getConfig("b"), evaluateAfter: [aSig] }, (node, properties) => {
				return genericResult;
			});
		}).toThrow("belongs to appearance group");
	});

	test("errors if you try to sequence a rule before & after the same dependecy", () => {
		const aSig = coreApi.addElementRule(getConfig("a"), (node, properties) => {
			return genericResult;
		});

		expect(() => {
			coreApi.addElementRule(
				{ ...getConfig("b"), evaluateBefore: [aSig], evaluateAfter: [aSig] },
				(node, properties) => {
					return genericResult;
				},
			);
		}).toThrow("cannot be evaluated before and after rule");
	});

	test("errors if you try to sequence a rule before or after a non added dependecy", () => {
		const aSig = coreApi.addElementRule(getConfig("a"), (node, properties) => {
			return genericResult;
		});

		expect(() => {
			jest.isolateModules(() => {
				(require("../src") as typeof import("../src")).addElementRule(
					{ ...getConfig("b"), evaluateAfter: [aSig] },
					(node, properties) => {
						return genericResult;
					},
				);
			});
		}).toThrow("'a' does not exist.");
		expect(() => {
			jest.isolateModules(() => {
				(require("../src") as typeof import("../src")).addElementRule(
					{ ...getConfig("b"), evaluateBefore: [aSig] },
					(node, properties) => {
						return genericResult;
					},
				);
			});
		}).toThrow("'a' does not exist.");
	});

	test("errors if you try to sequence a rule before or after the wrong type of dependecy", () => {
		expect(() => {
			const aSig = coreApi.addAppearanceRule("group1", getConfig("a"), (node, properties) => {
				return genericResult;
			});
			coreApi.addElementRule({ ...getConfig("b"), evaluateBefore: [aSig] }, (node, properties) => {
				return genericResult;
			});
		}).toThrow("cannot be evaluated before");

		expect(() => {
			const aSig = coreApi.addElementRule(getConfig("a"), (node, properties) => {
				return genericResult;
			});
			coreApi.addAppearanceRule("group1", { ...getConfig("b"), evaluateAfter: [aSig] }, (node, properties) => {
				return genericResult;
			});
		}).toThrow("cannot be evaluated after");
	});

	test("errors if rule dependencies are circular", () => {
		const aSig = coreApi.addElementRule(getConfig("a"), (node, properties) => {
			return genericResult;
		});
		const bSig = coreApi.addElementRule({ ...getConfig("b"), evaluateAfter: [aSig] }, (node, properties) => {
			return genericResult;
		});
		coreApi.addElementRule(
			{ ...getConfig("c"), evaluateAfter: [bSig], evaluateBefore: [aSig] },
			(node, properties) => {
				return genericResult;
			},
		);

		expect(() => {
			coreApi.orderRulesByDependencies(
				Object.keys(coreApi.elementRuleBySignature).map(key => coreApi.elementRuleBySignature[key]),
			);
		}).toThrow("Circular dependency detected");
	});

	test("sorts rules by evaluateAfter dependencies", () => {
		jest.isolateModules(() => {
			const coreApi = require("../src") as typeof import("../src");

			const aSig = coreApi.addElementRule(getConfig("a"), (node, properties) => {
				return genericResult;
			});
			const bSig = coreApi.addElementRule({ ...getConfig("b"), evaluateAfter: [aSig] }, (node, properties) => {
				return genericResult;
			});
			const cSig = coreApi.addElementRule({ ...getConfig("c"), evaluateAfter: [bSig] }, (node, properties) => {
				return genericResult;
			});

			const orderedRules = coreApi.orderRulesByDependencies(
				Object.keys(coreApi.elementRuleBySignature).map(key => coreApi.elementRuleBySignature[key]),
			);

			expect(orderedRules.map(rule => rule.name)).toEqual(["a", "b", "c"]);
		});
	});

	test("sorts rules by evaluateBefore dependencies", () => {
		jest.isolateModules(() => {
			const coreApi = require("../src") as typeof import("../src");

			const aSig = coreApi.addElementRule(getConfig("a"), (node, properties) => {
				return genericResult;
			});
			const bSig = coreApi.addElementRule({ ...getConfig("b"), evaluateBefore: [aSig] }, (node, properties) => {
				return genericResult;
			});
			const cSig = coreApi.addElementRule({ ...getConfig("c"), evaluateBefore: [bSig] }, (node, properties) => {
				return genericResult;
			});

			const orderedRules = coreApi.orderRulesByDependencies(
				Object.keys(coreApi.elementRuleBySignature).map(key => coreApi.elementRuleBySignature[key]),
			);

			expect(orderedRules.map(rule => rule.name)).toEqual(["c", "b", "a"]);
		});
	});

	test("sorts rules by complex dependencies", () => {
		jest.isolateModules(() => {
			const coreApi = require("../src") as typeof import("../src");

			const aSig = coreApi.addElementRule(getConfig("a"), (node, properties) => {
				return genericResult;
			});
			const bSig = coreApi.addElementRule({ ...getConfig("b"), evaluateAfter: [aSig] }, (node, properties) => {
				return genericResult;
			});
			const cSig = coreApi.addElementRule({ ...getConfig("c"), evaluateAfter: [bSig] }, (node, properties) => {
				return genericResult;
			});
			const abSig = coreApi.addElementRule(
				{ ...getConfig("ab"), evaluateAfter: [aSig], evaluateBefore: [bSig] },
				(node, properties) => {
					return genericResult;
				},
			);
			const acSig = coreApi.addElementRule(
				{ ...getConfig("ac"), evaluateAfter: [aSig, abSig], evaluateBefore: [cSig] },
				(node, properties) => {
					return genericResult;
				},
			);
			const dSig = coreApi.addElementRule(
				{ ...getConfig("d"), evaluateAfter: [acSig], evaluateBefore: [cSig] },
				(node, properties) => {
					return genericResult;
				},
			);
			const eSig = coreApi.addElementRule({ ...getConfig("e"), evaluateAfter: [cSig] }, (node, properties) => {
				return genericResult;
			});
			const fSig = coreApi.addElementRule(
				{ ...getConfig("f"), evaluateAfter: [abSig, acSig, dSig], evaluateBefore: [eSig] },
				(node, properties) => {
					return genericResult;
				},
			);
			const gSig = coreApi.addElementRule(
				{ ...getConfig("g"), evaluateAfter: [cSig], evaluateBefore: [fSig] },
				(node, properties) => {
					return genericResult;
				},
			);
			const hSig = coreApi.addElementRule({ ...getConfig("h"), evaluateAfter: [gSig] }, (node, properties) => {
				return genericResult;
			});
			const iSig = coreApi.addElementRule(
				{ ...getConfig("i"), evaluateAfter: [gSig], evaluateBefore: [eSig] },
				(node, properties) => {
					return genericResult;
				},
			);
			const jSig = coreApi.addElementRule(
				{ ...getConfig("j"), evaluateAfter: [hSig], evaluateBefore: [fSig] },
				(node, properties) => {
					return genericResult;
				},
			);
			const kSig = coreApi.addElementRule(
				{ ...getConfig("k"), evaluateAfter: [fSig], evaluateBefore: [eSig] },
				(node, properties) => {
					return genericResult;
				},
			);
			const lSig = coreApi.addElementRule({ ...getConfig("l"), evaluateAfter: [eSig] }, (node, properties) => {
				return genericResult;
			});

			const orderedRules = coreApi.orderRulesByDependencies(
				Object.keys(coreApi.elementRuleBySignature).map(key => coreApi.elementRuleBySignature[key]),
			);

			expect(orderedRules.map(rule => rule.name)).toEqual([
				"a",
				"ab",
				"b",
				"ac",
				"d",
				"c",
				"g",
				"h",
				"i",
				"j",
				"f",
				"k",
				"e",
				"l",
			]);
		});
	});
});
