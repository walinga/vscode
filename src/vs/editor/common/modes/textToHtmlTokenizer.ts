/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as strings from 'vs/base/common/strings';
import { ITokenizationSupport, IState, LanguageId } from 'vs/editor/common/modes';
import { LineTokens, IViewLineTokens } from 'vs/editor/common/core/lineTokens';
import { CharCode } from 'vs/base/common/charCode';
import { NULL_STATE, nullTokenize2 } from 'vs/editor/common/modes/nullMode';

const fallback = {
	getInitialState: () => NULL_STATE,
	tokenize: undefined,
	tokenize2: (buffer: string, state: IState, deltaOffset: number) => nullTokenize2(LanguageId.Null, buffer, state, deltaOffset)
};

export function tokenizeToString(text: string, tokenizationSupport: ITokenizationSupport = fallback): string {
	return _tokenizeToString(text, tokenizationSupport || fallback);
}

export function tokenizeLineToHTML(text: string, viewLineTokens: IViewLineTokens, colorMap: string[], startOffset: number, endOffset: number, tabSize: number): string {
	let result = `<div>`;
	let charIndex = startOffset;
	let tabsCharDelta = 0;

	for (let tokenIndex = 0, tokenCount = viewLineTokens.getCount(); tokenIndex < tokenCount; tokenIndex++) {
		const tokenEndIndex = viewLineTokens.getEndOffset(tokenIndex);

		if (tokenEndIndex <= startOffset) {
			continue;
		}

		let partContent = '';

		for (; charIndex < tokenEndIndex && charIndex < endOffset; charIndex++) {
			const charCode = text.charCodeAt(charIndex);

			switch (charCode) {
				case CharCode.Tab:
					let insertSpacesCount = tabSize - (charIndex + tabsCharDelta) % tabSize;
					tabsCharDelta += insertSpacesCount - 1;
					while (insertSpacesCount > 0) {
						partContent += '&nbsp;';
						insertSpacesCount--;
					}
					break;

				case CharCode.LessThan:
					partContent += '&lt;';
					break;

				case CharCode.GreaterThan:
					partContent += '&gt;';
					break;

				case CharCode.Ampersand:
					partContent += '&amp;';
					break;

				case CharCode.Null:
					partContent += '&#00;';
					break;

				case CharCode.UTF8_BOM:
				case CharCode.LINE_SEPARATOR_2028:
					partContent += '\ufffd';
					break;

				case CharCode.CarriageReturn:
					// zero width space, because carriage return would introduce a line break
					partContent += '&#8203';
					break;

				default:
					partContent += String.fromCharCode(charCode);
			}
		}

		result += `<span style="${viewLineTokens.getInlineStyle(tokenIndex, colorMap)}">${partContent}</span>`;

		if (tokenEndIndex > endOffset || charIndex >= endOffset) {
			break;
		}
	}

	result += `</div>`;
	return result;
}

function _tokenizeToString(text: string, tokenizationSupport: ITokenizationSupport): string {
	let result = `<div class="monaco-tokenized-source">`;
	let lines = text.split(/\r\n|\r|\n/);
	let currentState = tokenizationSupport.getInitialState();
	for (let i = 0, len = lines.length; i < len; i++) {
		let line = lines[i];

		if (i > 0) {
			result += `<br/>`;
		}

		let tokenizationResult = tokenizationSupport.tokenize2(line, currentState, 0);
		LineTokens.convertToEndOffset(tokenizationResult.tokens, line.length);
		let lineTokens = new LineTokens(tokenizationResult.tokens, line);
		let viewLineTokens = lineTokens.inflate();

		let startOffset = 0;
		for (let j = 0, lenJ = viewLineTokens.getCount(); j < lenJ; j++) {
			const type = viewLineTokens.getClassName(j);
			const endIndex = viewLineTokens.getEndOffset(j);
			result += `<span class="${type}">${strings.escape(line.substring(startOffset, endIndex))}</span>`;
			startOffset = endIndex;
		}

		currentState = tokenizationResult.endState;
	}

	result += `</div>`;
	return result;
}
