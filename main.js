// ==UserScript==
// @name         TweetDeck notification collapser
// @namespace    https://yal.cc/
// @version      2019-01-11
// @description  try to take over the world!
// @author       YellowAfterlife
// @match        https://twitter.com/i/*
// @match        https://x.com/i/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
	const ccPrefix = `cc_yal_tweetdeck_collapse_notification`;
	const ccTweet = `${ccPrefix}`;
	const ccCollapsed = `${ccPrefix}_collapsed`;
	const ccOverflow = `${ccPrefix}_overflow`;
	const ccDataHash = `${ccPrefix}_hash`;
	const ccTitle = `${ccPrefix}_text`;
	/** */
	function findc(node, className, index) {
		return node.getElementsByClassName(className)[index || 0];
	}
	/** "http://twitter.com/user" -> "@user" */
	function twhandle(url) {
		var i = url.lastIndexOf("/");
		return "@" + url.substring(i + 1).toLowerCase();
	}

	function startsWith(str, sub) {
		var len = sub.length;
		return str.length >= len && str.substring(0, len) == sub;
	}
	const animTime = 200; // ms
    let mainStyle = document.createElement("style");
	mainStyle.innerHTML = (function() {
	let tx = `${animTime}ms`;
	let cqPrefix = `.chirp-container .`;
	let cqTweet = cqPrefix + ccTweet;
	let cqCollapsed = cqPrefix + ccCollapsed;
	let cqOverflow = cqPrefix + ccOverflow;
	let cqDataHash = cqPrefix + ccDataHash;
	return `
	${cqTweet} {
		transition: height ${tx}, opacity ${tx}, background-color ${tx};
		background: rgba(0, 0, 0, 0);
		position: relative;
		opacity: 1.0;
	}
	${cqCollapsed} {
		/*opacity: 0.8;*/
		height: 20px !important;
		cursor: pointer;
	}
	${cqOverflow} {
		overflow: hidden;
	}
	${cqCollapsed} .activity-header {
		height: 20px;
		overflow: hidden;
	}

	${cqTweet} .avatar {
		transition: width ${tx}, height ${tx}, margin ${tx};
	}
	${cqCollapsed} .avatar,
	${cqCollapsed} .avatar.size24 {
		width: 16px;
		height: 16px;
	}
	${cqCollapsed} .nbfc .avatar {
		position: relative;
		top: -1px;
	}
	${cqCollapsed}[data-key^="follow"] .avatar {
		margin-top: -21px;
		margin-right: -26px;
	}

	${cqTweet}[data-key^="follow"] .nbfc.txt-mute {
		transition: margin-left ${tx};
		margin-left: 0px;
	}
	${cqCollapsed}[data-key^="follow"] .nbfc.txt-mute {
		margin-left: 26px;
	}

	${cqTweet}[data-key^="follow"] .activity-header .nbfc.txt-small,
	${cqTweet}[data-key^="follow"] .activity-header .nbfc.txt-mute {
		font-size: inherit !important;
	}
	${cqTweet}[data-key^="follow"] .activity-header .nbfc.txt-mute,
	${cqTweet}[data-key^="follow"] .activity-header .nbfc.txt-mute a:not(:hover):not(:focus) {
		color: inherit;
	}

	${cqTweet} > div { transition: padding 200ms }
	${cqCollapsed} > div {
		padding-top: 1px;
	}

	${cqTweet} .activity-header .align-below-header {
		transition: top 200ms;
		margin-bottom: 16px;
	}
	${cqCollapsed} .activity-header .align-below-header {
		top: 0px;
	}

	${cqCollapsed} .activity-header,
	${cqCollapsed} .activity-header.has-source-avatar {
		margin-top: -2px;
	}
	${cqCollapsed} .item-img {
		position: relative;
		top: 4px;
	}
	
	${cqDataHash} {
		position: absolute;
		right: 2px;
		top: 2px;
		z-index: 2;
		padding: 0 2px;
		font-size: 0.8571428571rem;
		background: rgba(255, 255, 255, 0.5);
		color: black;
	}
	html.dark ${cqDataHash} {
		background: rgba(0, 0, 0, 0.8);
		color: white;
	}
	`;})();
	mainStyle.id = `${ccPrefix}_main`;
	document.body.appendChild(mainStyle);
	//
	let dataHashCss = `
	body[${ccDataHash}="__hash__"] .${ccTweet}[${ccDataHash}="__hash__"] {
		background: rgba(240, 200, 120, 0.4);
	}
	html.dark body[${ccDataHash}="__hash__"] .${ccTweet}[${ccDataHash}="__hash__"] {
		background: rgba(170, 120, 80, 0.3);
	}
	`;
	let dataHashCssRx = /__hash__/g;
	let dataHashMap = { };
	function findDataHashEvents(key) {
		var out = dataHashMap[key];
		if (out) return out;
		// consideration: find a proper way to hash a long timestamp
		var bits = 0x0;
		for (let i = 0; i < key.length; i += 9) {
			bits = (bits << 8) | ((bits & 0xff000000) >>> 24);
			bits ^= parseInt(key.substr(i, 9)) * 48271 % 2147483647;
			bits = bits >>> 0;
		}
		var hash = bits.toString(16);
		for (let i = hash.length; i < 8; i++) hash = "0" + hash;
		//
		var style = null;
		var removeTimer = null;
		out = [hash, function hashMouseEnter(e) {
			if (style === null) {
				style = document.createElement("style");
				style.innerHTML = dataHashCss.replace(dataHashCssRx, hash);
				style.id = ccDataHash + "_" + hash;
			}
			if (removeTimer === null) {
				if (style.parentElement === null) {
					document.body.appendChild(style);
				}
			} else clearTimeout(removeTimer);
			setTimeout(function() {
				document.body.setAttribute(ccDataHash, hash);
			}, 0);
		}, function hashMouseOut(e) {
			document.body.setAttribute(ccDataHash, "");
			removeTimer = setTimeout(function() {
				document.body.removeChild(style);
				removeTimer = null;
			}, 200);
		}];
		dataHashMap[key] = out;
		//
		return out;
	}
	function makeDataHash(node) {
		var key = node.getAttribute("data-key");
		// clip the key if it is in "data_id_key" format:
		var i = key.lastIndexOf("_");
		if (i >= 0) key = key.substr(i + 1);
		if (findc(node, "tweet-context") || findc(node, "activity-header")) {
			var data = findDataHashEvents(key);
			var r = document.createElement("span");
			r.className = ccDataHash;
			r.innerHTML = data[0];
			node.setAttribute(ccDataHash, data[0]);
			node.insertBefore(r, node.children[0]);
			node.addEventListener("mouseover", data[1]);
			node.addEventListener("mouseleave", data[2]);
		}
	}
	//
	function makeToggleFunc(node) {
		return function(e) {
			let ncl = node.classList;
			if (ncl.contains(ccCollapsed)) {
				ncl.remove(ccCollapsed);
				let fixHeight = !node.style.height;
				if (fixHeight) node.style.height = node.scrollHeight + "px";
				setTimeout(() => {
					ncl.remove(ccOverflow);
					if (fixHeight) node.style.height = node.scrollHeight + "px";
				}, animTime);
				node.title = "";
				e.stopPropagation();
				e.preventDefault();
			} else {
				let tcl = e.target.classList;
				if (tcl.contains("nbfc") || tcl.contains("item-box") || tcl.contains("activity-header")) {
					// minimize by clicking user/info line
					ncl.add(ccCollapsed);
					ncl.add(ccOverflow);
					node.title = node.getAttribute(ccTitle);
					e.stopPropagation();
				}
			}
		};
	}
	//
	function makeCollapsible(node) {
		node.classList.add(ccTweet);
		let awaitHeight;
		function awaitHeight_fn() {
			if (node.scrollHeight <= 0) return;
			clearInterval(awaitHeight);
			node.style.height = node.scrollHeight + "px";
			//
			if (node.previousSibling) {
				// hiding everything instantly can break scrolling, so delay a bit:
				setTimeout(() => node.classList.add(ccCollapsed), 100);
			} else node.classList.add(ccCollapsed);
			node.classList.add(ccOverflow);
			let tweetText = node.querySelector(".tweet-text");
			let altText = tweetText ? tweetText.textContent : "";
			node.title = altText;
			node.setAttribute(ccTitle, altText);
			node.addEventListener("click", makeToggleFunc(node));
			makeDataHash(node);
		}
		awaitHeight = setInterval(awaitHeight_fn, 10);
		awaitHeight_fn();
	}
	//
	let __checkColumns = null;
	__checkColumns = setInterval(function checkColumns() {
		let columns = document.querySelectorAll(`.js-column`);
		if (columns.length === 0) return;
		clearInterval(__checkColumns);
		for (let column of document.querySelectorAll(`.js-column`)) {
			if (!column.querySelector(`.column-type-icon.icon-notifications`)) continue;
			let container = column.querySelector(`.chirp-container`);
			let observer = new MutationObserver(function(mutations) {
				mutations.forEach(function(mutation) {
					let addedNodes = mutation.addedNodes;
					for (let node of addedNodes) {
						if (node.tagName != "ARTICLE") continue;
						let key = node.getAttribute("data-key");
						if (!key) continue;
						if (startsWith(key, "favorite") ||
							startsWith(key, "retweet") ||
							startsWith(key, "follow")) {
							makeCollapsible(node);
						}
					}
				});
			});
			observer.observe(container, { childList: true });
		}
	}, 500);
})();