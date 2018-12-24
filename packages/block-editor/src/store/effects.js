/**
 * External dependencies
 */
import { last } from 'lodash';

/**
 * WordPress dependencies
 */
import { speak } from '@wordpress/a11y';
import {
	getBlockType,
	doBlocksMatchTemplate,
	switchToBlockType,
	synchronizeBlocksWithTemplate,
} from '@wordpress/blocks';
import { _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	replaceBlocks,
	selectBlock,
	setTemplateValidity,
	insertDefaultBlock,
	resetBlocks,
} from './actions';
import {
	getBlock,
	getBlocks,
	getSelectedBlockCount,
	getBlockCount,
	getBlockRootClientId,
	getPreviousBlockClientId,
	getSelectedBlockClientId,
	getTemplateLock,
	getTemplate,
	isValidTemplate,
} from './selectors';

/**
 * Block validity is a function of blocks state (at the point of a
 * reset) and the template setting. As a compromise to its placement
 * across distinct parts of state, it is implemented here as a side-
 * effect of the block reset action.
 *
 * @param {Object} action RESET_BLOCKS action.
 * @param {Object} store  Store instance.
 *
 * @return {?Object} New validity set action if validity has changed.
 */
export function validateBlocksToTemplate( action, store ) {
	const state = store.getState();
	const template = getTemplate( state );
	const templateLock = getTemplateLock( state );

	// Unlocked templates are considered always valid because they act
	// as default values only.
	const isBlocksValidToTemplate = (
		! template ||
		templateLock !== 'all' ||
		doBlocksMatchTemplate( action.blocks, template )
	);

	// Update if validity has changed.
	if ( isBlocksValidToTemplate !== isValidTemplate( state ) ) {
		return setTemplateValidity( isBlocksValidToTemplate );
	}
}

/**
 * Effect handler which will return a block select action to select the block
 * occurring before the selected block in the previous state, unless it is the
 * same block or the action includes a falsey `selectPrevious` option flag.
 *
 * @param {Object} action Action which had initiated the effect handler.
 * @param {Object} store  Store instance.
 *
 * @return {?Object} Block select action to select previous, if applicable.
 */
export function selectPreviousBlock( action, store ) {
	// if the action says previous block should not be selected don't do anything.
	if ( ! action.selectPrevious ) {
		return;
	}

	const firstRemovedBlockClientId = action.clientIds[ 0 ];
	const state = store.getState();
	const selectedBlockClientId = getSelectedBlockClientId( state );

	// recreate the state before the block was removed.
	const previousState = { ...state, editor: { present: last( state.editor.past ) } };

	// rootClientId of the removed block.
	const rootClientId = getBlockRootClientId( previousState, firstRemovedBlockClientId );

	// Client ID of the block that was before the removed block or the
	// rootClientId if the removed block was first amongst its siblings.
	const blockClientIdToSelect = getPreviousBlockClientId( previousState, firstRemovedBlockClientId ) || rootClientId;

	// Dispatch select block action if the currently selected block
	// is not already the block we want to be selected.
	if ( blockClientIdToSelect !== selectedBlockClientId ) {
		return selectBlock( blockClientIdToSelect, -1 );
	}
}

/**
 * Effect handler which will return a default block insertion action if there
 * are no other blocks at the root of the editor. This is expected to be used
 * in actions which may result in no blocks remaining in the editor (removal,
 * replacement, etc).
 *
 * @param {Object} action Action which had initiated the effect handler.
 * @param {Object} store  Store instance.
 *
 * @return {?Object} Default block insert action, if no other blocks exist.
 */
export function ensureDefaultBlock( action, store ) {
	if ( ! getBlockCount( store.getState() ) ) {
		return insertDefaultBlock();
	}
}

export default {
	MERGE_BLOCKS( action, store ) {
		const { dispatch } = store;
		const state = store.getState();
		const [ firstBlockClientId, secondBlockClientId ] = action.blocks;
		const blockA = getBlock( state, firstBlockClientId );
		const blockType = getBlockType( blockA.name );

		// Only focus the previous block if it's not mergeable
		if ( ! blockType.merge ) {
			dispatch( selectBlock( blockA.clientId ) );
			return;
		}

		// We can only merge blocks with similar types
		// thus, we transform the block to merge first
		const blockB = getBlock( state, secondBlockClientId );
		const blocksWithTheSameType = blockA.name === blockB.name ?
			[ blockB ] :
			switchToBlockType( blockB, blockA.name );

		// If the block types can not match, do nothing
		if ( ! blocksWithTheSameType || ! blocksWithTheSameType.length ) {
			return;
		}

		// Calling the merge to update the attributes and remove the block to be merged
		const updatedAttributes = blockType.merge(
			blockA.attributes,
			blocksWithTheSameType[ 0 ].attributes
		);

		dispatch( selectBlock( blockA.clientId, -1 ) );
		dispatch( replaceBlocks(
			[ blockA.clientId, blockB.clientId ],
			[
				{
					...blockA,
					attributes: {
						...blockA.attributes,
						...updatedAttributes,
					},
				},
				...blocksWithTheSameType.slice( 1 ),
			]
		) );
	},
	RESET_BLOCKS: [
		validateBlocksToTemplate,
	],
	REMOVE_BLOCKS: [
		selectPreviousBlock,
		ensureDefaultBlock,
	],
	REPLACE_BLOCKS: [
		ensureDefaultBlock,
	],
	MULTI_SELECT: ( action, { getState } ) => {
		const blockCount = getSelectedBlockCount( getState() );

		/* translators: %s: number of selected blocks */
		speak( sprintf( _n( '%s block selected.', '%s blocks selected.', blockCount ), blockCount ), 'assertive' );
	},
	SYNCHRONIZE_TEMPLATE( action, { getState } ) {
		const state = getState();
		const blocks = getBlocks( state );
		const template = getTemplate( state );
		const updatedBlockList = synchronizeBlocksWithTemplate( blocks, template );

		return resetBlocks( updatedBlockList );
	},
};
