// plopfile.js
module.exports = (plop) => {
	// Mode generator
	plop.setGenerator("mode", {
		description: "Generate a new mode configuration",
		prompts: [
			{
				type: "input",
				name: "slug",
				message: "Mode slug (e.g., my-cool-mode):",
				validate: (value) => {
					if (/.+/.test(value)) {
						return true;
					}
					return "slug is required";
				},
			},
			{
				type: "input",
				name: "name",
				message: "Mode display name (e.g., My Cool Mode):",
				validate: (value) => {
					if (/.+/.test(value)) {
						return true;
					}
					return "name is required";
				},
			},
		],
		actions: [
			{
				type: "add",
				path: "src/modes/rules-{{dashCase slug}}/index.json",
				templateFile: "plop-templates/mode/index.json.hbs",
			},
			{
				type: "add",
				path: "src/modes/rules-{{dashCase slug}}/instructions.md",
				templateFile: "plop-templates/mode/instructions.md.hbs",
			},
			// Optional: Add a message indicating success
			(data) => {
				return `Mode '${data.name}' (${data.slug}) generated successfully in src/modes/rules-${plop.getHelper("dashCase")(data.slug)}/`;
			},
		],
	});
};
