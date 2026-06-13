import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

import Content from './dropdown-menu-content.svelte';
import Item from './dropdown-menu-item.svelte';
import GroupHeading from './dropdown-menu-group-heading.svelte';
import Separator from './dropdown-menu-separator.svelte';

const Root = DropdownMenuPrimitive.Root;
const Trigger = DropdownMenuPrimitive.Trigger;
const Group = DropdownMenuPrimitive.Group;
const Portal = DropdownMenuPrimitive.Portal;

export {
  Root,
  Trigger,
  Group,
  Portal,
  Content,
  Item,
  GroupHeading,
  Separator,
  //
  Root as DropdownMenu,
  Trigger as DropdownMenuTrigger,
  Group as DropdownMenuGroup,
  Portal as DropdownMenuPortal,
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  GroupHeading as DropdownMenuGroupHeading,
  Separator as DropdownMenuSeparator,
};
