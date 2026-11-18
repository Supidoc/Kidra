package main

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/xiam/s-expr/ast"
)

// Pure helpers that read KiCad s-expressions (symbols and footprints).

// sexprHead returns the first token of an expression, e.g. "symbol" for (symbol "R" ...).
func sexprHead(node *ast.Node) string {
	if node == nil || !node.IsVector() || len(node.List()) == 0 {
		return ""
	}
	first := node.List()[0]
	if first.IsVector() || first.Token() == nil {
		return ""
	}
	return first.Token().Text()
}

// sexprArg returns the text of the i-th element of an expression (0 = head), or "".
func sexprArg(node *ast.Node, index int) string {
	if node == nil || !node.IsVector() || len(node.List()) <= index {
		return ""
	}
	item := node.List()[index]
	if item.IsVector() || item.Token() == nil {
		return ""
	}
	return item.Token().Text()
}

// sexprChildren returns the direct sub-expressions with the given head.
func sexprChildren(node *ast.Node, head string) []*ast.Node {
	if node == nil || !node.IsVector() {
		return nil
	}
	var result []*ast.Node
	for _, child := range node.List() {
		if child.IsVector() && sexprHead(child) == head {
			result = append(result, child)
		}
	}
	return result
}

// sexprCanonical writes a canonical text form of a node. It is stable across
// formatting changes (whitespace, line breaks) but changes with any content change.
func sexprCanonical(node *ast.Node, builder *strings.Builder) {
	if node.IsVector() {
		builder.WriteByte('(')
		for i, child := range node.List() {
			if i > 0 {
				builder.WriteByte(' ')
			}
			sexprCanonical(child, builder)
		}
		builder.WriteByte(')')
		return
	}
	builder.WriteString(node.Encode())
}

// sexprHash returns the hex sha256 of the canonical form of a node, optionally
// mixed with extra strings (e.g. the hash of a parent symbol).
func sexprHash(node *ast.Node, extra ...string) string {
	var builder strings.Builder
	sexprCanonical(node, &builder)
	for _, value := range extra {
		builder.WriteString("\x00")
		builder.WriteString(value)
	}
	sum := sha256.Sum256([]byte(builder.String()))
	return hex.EncodeToString(sum[:])
}

// symbolExtends returns the parent name of a derived symbol ((extends "Parent")), or "".
func symbolExtends(symbol *ast.Node) string {
	for _, extends := range sexprChildren(symbol, "extends") {
		return sexprArg(extends, 1)
	}
	return ""
}

// symbolPinNumbers collects the unique pin numbers of a symbol, including the
// pins defined in its unit sub-symbols ((symbol "X_1_1" ...)).
func symbolPinNumbers(symbol *ast.Node) map[string]struct{} {
	pins := make(map[string]struct{})
	var walk func(node *ast.Node)
	walk = func(node *ast.Node) {
		if node == nil || !node.IsVector() {
			return
		}
		if sexprHead(node) == "pin" {
			for _, number := range sexprChildren(node, "number") {
				if value := strings.TrimSpace(sexprArg(number, 1)); value != "" {
					pins[value] = struct{}{}
				}
			}
			return
		}
		for _, child := range node.List() {
			walk(child)
		}
	}
	walk(symbol)
	return pins
}

// footprintPadCount counts the unique, non-empty pad numbers of a footprint.
func footprintPadCount(footprint *ast.Node) int {
	pads := make(map[string]struct{})
	for _, pad := range sexprChildren(footprint, "pad") {
		number := strings.TrimSpace(sexprArg(pad, 1))
		if number == "" || number == `""` {
			continue
		}
		pads[number] = struct{}{}
	}
	return len(pads)
}

// footprintModel returns the path of the first (model "...") of a footprint, or "".
func footprintModel(footprint *ast.Node) string {
	for _, model := range sexprChildren(footprint, "model") {
		if path := sexprArg(model, 1); path != "" {
			return path
		}
	}
	return ""
}

// symbolInfo is what the symbol parser extracts per top-level symbol.
type symbolInfo struct {
	name     string
	hash     string
	pinCount int
}

// collectSymbolInfos extracts name, hash and pin count for every top-level symbol of
// a parsed library root ((kicad_symbol_lib ...)). Derived symbols ((extends ...))
// inherit the pins of their parent and mix its hash into their own, so a change to
// the parent re-renders the child. Unknown parents give 0 pins.
func collectSymbolInfos(library *ast.Node) []symbolInfo {
	nodes := make(map[string]*ast.Node)
	var order []string
	for _, item := range sexprChildren(library, "symbol") {
		name := sexprArg(item, 1)
		if name == "" {
			continue
		}
		if _, exists := nodes[name]; !exists {
			order = append(order, name)
		}
		nodes[name] = item
	}

	type resolved struct {
		hash string
		pins map[string]struct{}
	}
	cache := make(map[string]resolved)
	var resolve func(name string, depth int) resolved
	resolve = func(name string, depth int) resolved {
		if value, ok := cache[name]; ok {
			return value
		}
		node, ok := nodes[name]
		if !ok || depth > 16 {
			return resolved{}
		}
		value := resolved{pins: symbolPinNumbers(node)}
		if parent := symbolExtends(node); parent != "" && parent != name {
			parentValue := resolve(parent, depth+1)
			if len(value.pins) == 0 {
				value.pins = parentValue.pins
			}
			value.hash = sexprHash(node, parentValue.hash)
		} else {
			value.hash = sexprHash(node)
		}
		cache[name] = value
		return value
	}

	infos := make([]symbolInfo, 0, len(order))
	for _, name := range order {
		value := resolve(name, 0)
		infos = append(infos, symbolInfo{name: name, hash: value.hash, pinCount: len(value.pins)})
	}
	return infos
}
