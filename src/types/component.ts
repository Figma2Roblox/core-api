import { Color3, ColorSequence, CreatableInstances, Font, NumberSequence, Rect, UDim, UDim2, Vector2 } from "@figma2rbx/rbx-ui"

type UserData = UDim | UDim2 | Vector2 | Color3 | ColorSequence | NumberSequence | Font | Rect
type Primitive = string | number | boolean

export type ComponentProperty = UserData | Primitive | CreatableInstances | Component

export type CustomComponent = {
    moduleName: string
    modulePath?: string[]
}

export type Component = {
    name: string
    source: ComponentNode | CustomComponent
    children: (Component | CreatableInstances[keyof CreatableInstances])[]
    properties: ComponentProperties
}