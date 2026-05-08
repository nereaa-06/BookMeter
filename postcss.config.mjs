import postcssCascadeLayers from '@csstools/postcss-cascade-layers'

export default {
	plugins: [
		// Flatten cascade layers for older Android WebView engines (API 29).
		postcssCascadeLayers(),
	],
}
