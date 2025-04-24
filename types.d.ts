// types.d.ts

// Defines the structure for the 'edit' group with file restrictions
type EditGroupRestriction = {
	fileRegex: string;
	description: string;
};

// Defines the possible types for the 'groups' array elements
// Based on documentation, only 'edit' supports restrictions currently.
type RooToolGroup =
	| "read"
	| "edit" // Represents unrestricted edit access
	| ["edit", EditGroupRestriction] // Represents edit access with restrictions
	| "browser"
	| "command"
	| "mcp";

// Defines the structure of a Roo mode definition object
// Making it available globally by declaring it without export in a .d.ts file
declare type RooModeDefinition = {
	slug: string;
	name: string;
	roleDefinition: string;
	groups: RooToolGroup[];
	customInstructions?: string; // Optional custom instructions
};
