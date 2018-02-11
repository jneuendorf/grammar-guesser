import fs from 'fs'
import util from 'util'
import {Grammars} from 'ebnf'
import flatten from 'lodash.flatten'
import unique from 'lodash.uniq'

import {code, cursorPos} from './scenario1'



const grammar = fs.readFileSync('./grammars/preschool.ebnf', {encoding: 'utf8'})
const parser = new Grammars.BNF.Parser(grammar, {keepUpperRules: true})

/*
interface IToken {
    type: string;         // Rule name
    text: string;         // Inner text
    children: IToken[];   // Children nodes
    start: number;        // Start position of the input string
    end: number;          // End position
    errors: TokenError[]; // List of Errors
}
*/
const ast = parser.getAST(code)
// console.log(util.inspect(ast, {showHidden: false, depth: null}))

const findAtomicNode = node => {
    if (node.end === cursorPos && node.children.length === 0) {
        return node
    }
    return node.children.map(child => findAtomicNode(child)).filter(node => node)[0]
}
const atomicNode = findAtomicNode(ast)

const nodesEndingAtCursorPos = [atomicNode]

let parent = atomicNode.parent
while (parent && parent.end === cursorPos) {
    nodesEndingAtCursorPos.push(parent)
    parent = parent.parent
}

// console.log(util.inspect(nodesEndingAtCursorPos, {showHidden: false, depth: 3}))

const grammarRules = {}
for (const {name, bnf} of parser.grammarRules) {
    grammarRules[name] = bnf
}
// console.log('')
// console.log(util.inspect(grammarRules, {showHidden: false, depth: null}))

// Enable O(1) lookup for potential parents (O(1) requires dictionaries => immutable!).
const parentsByRule = {}
for (const {name} of parser.grammarRules) {
    for (const {name: potentialParent, bnf: rules} of parser.grammarRules) {
        if (potentialParent === name) {
            continue
        }

        for (const rule of rules) {
            if (rule.includes(name)) {
                if (name in parentsByRule) {
                    parentsByRule[name].push(potentialParent)
                }
                else {
                    parentsByRule[name] = [potentialParent]
                }
            }
        }
    }
}
for (const [rule, parents] of Object.entries(parentsByRule)) {
    // TODO: use immutable Set
    parentsByRule[rule] = [...new Set(parents)]
}
// console.log(parentsByRule)

const getMatchingRules = node => {
    const {parent: currentParent, type} = node
    const possibilities = []
    const parents = parentsByRule[type]
    if (parents.length === 0) {
        return possibilities
    }

    const matchingRules = []
    for (const parent of parents) {
        const parentRules = grammarRules[parent]
        for (const parentRule of parentRules) {
            const index = parentRule.indexOf(type)
            if (index >= 0) {
                // Exclude rules that equal [type]
                if (parentRule.length === 1) {
                    continue
                }

                const currentNodes = currentParent.children.slice(0, index + 1)
                const length = currentNodes.length

                let ruleMatches = true
                if (parentRule.length >= length) {
                    for (let i = 0; i < length; i++) {
                        if (parentRule[i] !== currentNodes[i].type) {
                            ruleMatches = false
                            break
                        }
                    }
                }

                if (ruleMatches) {
                    matchingRules.push(parentRule)
                }
            }
        }
    }
    return matchingRules
}
// console.log('')
// for (const node of nodesEndingAtCursorPos) {
//     console.log(getMatchingRules(node))
// }

const getPossibleNextRules = node => {
    const {type} = node
    const matchingRules = getMatchingRules(node)
    const possibilities = (
        matchingRules
        .map(rule => rule[rule.indexOf(type) + 1])
        .filter(node => node)
    )
    return possibilities
}
console.log('')
// for (const node of nodesEndingAtCursorPos) {
//     console.log(getPossibleNextRules(node))
// }
const possibilities = unique(flatten(
    nodesEndingAtCursorPos.map(node => getPossibleNextRules(node))
))
console.log(possibilities)


const getTerminalSymbols = rule => {
    // TODO: use Set
    const visitedRules = []
    const rec = rule => {
        if (visitedRules.indexOf(rule) >= 0) {
            // non-terminal => don't add it to the result
            if (rule in grammarRules) {
                return []
            }
            return [rule]
        }

        visitedRules.push(rule)

        if (rule in grammarRules) {
            return flatten(
                grammarRules[rule].map(
                    symbols => flatten(symbols.map(symbol => rec(symbol)))
                )
            )
        }
        else {
            return [rule]
        }
    }
    return unique(rec(rule)).map(terminalSymbol => eval(terminalSymbol))
}

console.log('')
for (const rule of possibilities) {
    console.log(getTerminalSymbols(rule))
}

//
// // console.log(parser.getAST(' '))
// const ast = parser.getAST('-12')
// // console.log(ast)
//
// const printNode = node => {
//     if (!node) {
//         return
//     }
//     console.log(node)
//     for (const child of node.children) {
//         printNode(child)
//     }
// }
// printNode(ast)
// // let node = ast
// // while (node) {
// //     node =
// // }
//
//
// // console.log(parser.getAST('-122 + 2'))
// // console.log(parser.getAST('-122 asdf + 2'))
