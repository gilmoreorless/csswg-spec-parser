# Problems found when parsing CSS spec pages

(I’ll raise issues for some of these.)

## Hard to determine shorthand properties

There is no definitive way to check whether a property is a shorthand. For most shorthands, the key signal is the text “see individual properties” in the computed value section, but this doesn't always hold true (see list below).

Even when a shorthand property is detected, it’s then impossible to accurately determine which longhands it expands to. Using the value syntax is no help, because it often refers to value types rather than other properties (`grid` is a good example of this).
The only way I’ve found so far is to look at the descriptive paragraph following the property definition table, and pick out all the properties mentioned there. This then needs manual verification for several reasons:

1. Multiple properties defined in the same table (e.g. `grid-column` / `grid-row`) end up referring to each other’s longhands.
2. Reset-only longhands are incorrectly picked up as being settable via the shorthand.
3. Sometimes unrelated properties are mentioned in the paragraph.

List of properties that were not detected as shorthands:

* `scroll-padding`
* `scroll-snap-margin`
* `grid-gap` (might not be a problem since it's moved to `gap` in a different spec)

List of reset-only longhands that are hard to detect:

* `border` resets `border-image` (and any future border properties)
* `grid` resets `grid-column-gap`, `grid-row-gap`
* `font` resets `font-size-adjust`, `font-kerning`, `font-language-override`, and `font-variant` (which is itself a shorthand, so multiple longhands are reset)
* `mask` resets `mask-border` (which is itself a shorthand)

List of properties that ambiguously refer to each other’s longhands:

* `grid-column` / `grid-row`


## Logical (flow-relative) properties create conflicting information

The way flow-relative properties are defined creates some confusion around shorthands and animations.

1. How to define shorthands in code? (e.g. `scroll-padding`)
2. Animation is discrete for flow-relative properties, even when animation is allowed for their equivalent physical properties (e.g. `margin-left` vs `margin-inline-start`)


## Some animatable properties are not picked up properly

(The undetectable shorthand problem also applies here.)

* `glyph-orientation-vertical` says “n/a” (wasn't picked up as a negative — it's the only property with this format)


## Conflicting information about animations for shorthands vs longhands

In some specs, there are shorthand properties defined as not animatable, even though they expand to longhands which are animatable.

* `grid-template-rows` and `grid-template-columns` are animatable “as a simple list of length, percentage, or calc, provided the only differences are the values of the length, percentage, or calc components in the list”. However, `grid` and `grid-template` shorthands have an animation type of “discrete”.
	* FIXED IN WORKING DRAFT — but the WD is inconsistent in use of "Animatable" vs "Animation type" in propdef tables

