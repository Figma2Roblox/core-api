import { CreatableInstances } from "@figma2rbx/rbx-ui"

export type Element = {
    name: string
    children: Element[]
    instance: CreatableInstances[keyof CreatableInstances],
}