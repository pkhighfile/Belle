'use strict';
define(['app','angular'], function (app, angular) {
angular.module('umbraco.services.dialog', [])
.factory('dialog', ['$rootScope', '$compile', '$http', '$timeout', '$q', '$templateCache', function($rootScope, $compile, $http, $timeout, $q, $templateCache) {
	
	function _open(options){	
		if(!options){
			options = {};
		}

		var scope = options.scope || $rootScope.$new(),
		templateUrl = options.template;
		
		var callback = options.callback;
		return $q.when($templateCache.get(templateUrl) || $http.get(templateUrl, {cache: true}).then(function(res) { return res.data; }))
		.then(function onSuccess(template) {

					// Build modal object
					var id = templateUrl.replace('.html', '').replace(/[\/|\.|:]/g, "-") + '-' + scope.$id;
					var $modal = $('<div class="modal umb-modal hide" data-backdrop="false" tabindex="-1"></div>')
									.attr('id', id)
									.addClass('fade')
									.html(template);

					if(options.modalClass){ 
						$modal.addClass(options.modalClass);
					}
							
					$('body').append($modal);

					// Compile modal content
					$timeout(function() {
						$compile($modal)(scope);
					});

					//Scope to handle data from the modal form
					scope.dialogData = {};
					scope.dialogData.selection = [];

					// Provide scope display functions
					scope.$modal = function(name) {
						$modal.modal(name);
					};
					
					scope.hide = function() {
						$modal.modal('hide');
					};

					scope.show = function() {
						$modal.modal('show');
					};

					scope.submit = function(data){
						callback(data);
						$modal.modal('hide');
					};

					scope.select = function(item){
						if(scope.dialogData.selection.indexOf(item) < 0){
							scope.dialogData.selection.push(item);	
						}	
					};

					scope.dismiss = scope.hide;

					// Emit modal events
					angular.forEach(['show', 'shown', 'hide', 'hidden'], function(name) {
						$modal.on(name, function(ev) {
							scope.$emit('modal-' + name, ev);
						});
					});

					// Support autofocus attribute
					$modal.on('shown', function(event) {
						$('input[autofocus]', $modal).first().trigger('focus');
					});

					//Autoshow	
					if(options.show) {
						$modal.modal('show');
					}

					//Return the modal object	
					return $modal;
				});	
}

return{
	open: function(options){
		return _open(options);
	},
	mediaPicker: function(options){
		return _open({
			scope: options.scope, 
			callback: options.callback, 
			template: 'views/common/dialogs/mediaPicker.html', 
			show: true});
	},
	contentPicker: function(options){
		return _open({
			scope: options.scope, 
			callback: options.callback, 
			template: 'views/common/dialogs/contentPicker.html', 
			show: true});
	},
	macroPicker: function(options){
		return _open({
			scope: options.scope, 
			callback: options.callback, 
			template: 'views/common/dialogs/macroPicker.html', 
			show: true});
	},
	propertyDialog: function(options){
		return _open({
			scope: options.scope, 
			callback: options.callback, 
			template: 'views/common/dialogs/property.html', 
			show: true});
	},
	append : function(options){
		var scope = options.scope || $rootScope.$new(), 
		templateUrl = options.template;

		return $q.when($templateCache.get(templateUrl) || $http.get(templateUrl, {cache: true}).then(function(res) { return res.data; }))
		.then(function onSuccess(template) {

						// Compile modal content
						$timeout(function() {
							options.container.html(template);
							$compile(options.container)(scope);
						});

						return template;
					});
	}  
};
}]);	
angular.module('umbraco.services.navigation', [])
.factory('navigationService', function ($rootScope, $routeParams, $log, dialog) {

	var _currentSection = $routeParams.section;
	var _currentId = $routeParams.id;
	var _currentNode;
	var _ui = {};
	var _actions = [];
	var _menuTitle = "";

	function _setMode(mode){
		switch(mode)
		{
			case 'tree':
			_ui.showNavigation = true;
			_ui.showContextMenu = false;
			_ui.showContextMenuDialog = false;
			_ui.stickyNavigation = false;
			break;
			case 'menu':
			_ui.showNavigation = true;
			_ui.showContextMenu = true;
			_ui.showContextMenuDialog = false;
			_ui.stickyNavigation = true;
			break;
			case 'dialog':
			_ui.stickyNavigation = true;
			_ui.showNavigation = true;
			_ui.showContextMenu = false;
			_ui.showContextMenuDialog = true;
			break;
			case 'search':
			_ui.stickyNavigation = false;
			_ui.showNavigation = true;
			_ui.showContextMenu = false;
			_ui.showSearchResults = true;
			_ui.showContextMenuDialog = false;
			break;      
			default:
			_ui.showNavigation = false;
			_ui.showContextMenu = false;
			_ui.showContextMenuDialog = false;
			_ui.showSearchResults = false;
			_ui.stickyNavigation = false;
			break;
		}
	}

	return {
		
		actions: _actions,
		currentSection: _currentSection,
		currentNode: _currentNode,
		currentId: _currentId,

		stickyNavigation: false,
		mode: "default",
		menuTitle: _menuTitle,
		ui: _ui,

		sections: function(){
			$log.log("fetch sections");

			return [
				{ name: "Content", cssclass: "content", alias: "content" },
				{ name: "Media", cssclass: "media", alias: "media" },
				{ name: "Settings", cssclass: "settings",  alias: "settings" },
				{ name: "Developer", cssclass: "developer", alias: "developer" },
				{ name: "Users", cssclass: "user", alias: "users" }
				];		
		},

		changeSection: function(sectionAlias){
			if(this.ui.stickyNavigation){
				_setMode("default-opensection");
				this.ui.currentSection = selectedSection;
				this.showTree(selectedSection);
			}
		},

		showTree: function(sectionAlias){

			if(!this.ui.stickyNavigation && sectionAlias !== this.ui.currentTree){
				$log.log("show tree" + sectionAlias);
				$("#search-form input").focus();
				this.ui.currentTree = sectionAlias;
				_setMode("tree");
			}
		},

		hideTree: function(){
			if(!this.ui.stickyNavigation){
				$log.log("hide tree");
				this.ui.currentTree = "";
				_setMode("default-hidesectiontree");
			}
		},

		showMenu: function (node, event) {
			$log.log("testing the show meny");

			if(event !== undefined && node.defaultAction && !event.altKey){
				//hack for now, it needs the complete action object to, so either include in tree item json
				//or lookup in service...
				var act = {
					alias: node.defaultAction,
					name: node.defaultAction
				};

				this.showDialog(node, act);

			}else{
				this.actions = tree.getActions({node: node, section: $scope.section});
				this.currentNode = node;
				this.menuTitle = node.name;
				_selectedId = node.id;
				_setMode("menu");
			}
		},

		hideMenu: function () {
			_selectedId = $routeParams.id;
			this.contextMenu = [];
			_setMode("tree");
		},

		showDialog: function (item, action) {
			_setMode("dialog");

			var _scope = $rootScope.$new();
			_scope.currentNode = item;

			//this.currentNode = item;
			this.dialogTitle = action.name;

			var templateUrl = "views/" + _currentSection + "/" + action.alias + ".html";
			var d = dialog.append(
						{
							container: $("#dialog div.umb-panel-body"),
							scope: _scope,
							template: templateUrl
						});
		},

		hideDialog: function() {
			this.showMenu(this.currentNode, undefined);
		},

		hideNavigation: function(){
			this.ui.currentSection = "";
			_setMode("default");
		}
	};

});
angular.module('umbraco.services.notifications', [])
.factory('notifications', function ($rootScope, $timeout) {

	var nArray = [];

	function add(item) {
		var index = nArray.length;
		nArray.push(item);


		$timeout(function () {
			$rootScope.$apply(function() {
				nArray.splice(index, 1);
			});
			
		}, 5000);

		return nArray[index];
	}

	return {
		success: function (headline, message) {
			return add({ headline: headline, message: message, type: 'success', time: new Date() });
		},
		error: function (headline, message) {
			return add({ headline: headline, message: message, type: 'error', time: new Date() });
		},
		warning: function (headline, message) {
			return add({ headline: headline, message: message, type: 'warning', time: new Date() });
		},
		remove: function (index) {
			nArray.splice(index, 1);
		},
		removeAll: function () {
			nArray = [];
		},

		current: nArray,

		getCurrent: function(){
			return nArray;
		}
	};
});
//script loader wrapping around 3rd party loader
angular.module('umbraco.services.search', [])
.factory('search', function () {
	return {
		search: function(term, section){

			return [
			{
				section: "settings",
				tree: "documentTypes",
				matches:[
				{ name: "News archive", path:"/News Archive", id: 1234, icon: "icon-list-alt", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 },
				{ name: "Meta Data", path:"/Seo/Meta Data", id: 1234, icon: "icon-list-alt", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 },
				{ name: "Dooo", path:"/Woop/dee/dooo", id: 1234, icon: "icon-list-alt red", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 }
				
				]	
			},
			{
				section: "content",
				tree: "content",
				matches:[
				{ name: "News", path:"/archive/news", id: 1234, icon: "icon-file", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 },
				{ name: "Data types", path:"/Something/About/Data-Types", id: 1234, icon: "icon-file", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 },
				{ name: "Dooo", path:"/Woop/dee/dooo", id: 1234, icon: "icon-file", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 }
				]	
			},

			{
				section: "developer",
				tree: "macros",
				matches:[
				{ name: "Navigation", path:"/Macros/Navigation.xslt", id: 1234, icon: "icon-cogs", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 },
				{ name: "List of stuff", path:"/Macros/Navigation.xslt", id: 1234, icon: "icon-cogs", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 },
				{ name: "Something else", path:"/Macros/Navigation.xslt",id: 1234, icon: "icon-cogs", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 }
				]	
			}
			];	
		},
		
		setCurrent: function(sectionAlias){
			currentSection = sectionAlias;	
		}
	};
});
angular.module('umbraco.services.section', [])
.factory('section', function ($rootScope) {

	var currentSection = "content";
	return {
		all: function(){
			return [
			{ name: "Content", cssclass: "content", alias: "content" },
			{ name: "Media", cssclass: "media", alias: "media" },
			{ name: "Settings", cssclass: "settings",  alias: "settings" },
			{ name: "Developer", cssclass: "developer", alias: "developer" },
			{ name: "Users", cssclass: "user", alias: "users" }
			];	
		},
		
		setCurrent: function(sectionAlias){
			currentSection = sectionAlias;	
		}
	};

});
angular.module('umbraco.services.tree', [])
.factory('tree', function () {
		//implement this in local storage
		var treeArray = [];
		var currentSection = "content";

		return {
			getTree: function (options) {

				if(options === undefined){
					options = {};
				}

				var section = options.section || 'content';
				var cacheKey = options.cachekey || '';
				cacheKey += "_" + section;	

				if (treeArray[cacheKey] !== undefined){
					return treeArray[cacheKey];
				}
				
				var t;
				switch(section){

					case "content":
					t = {
						name: section,
						alias: section,

						children: [
							{ name: "My website", id: 1234, icon: "icon-home", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1, defaultAction: "create" },
							{ name: "Components", id: 1235, icon: "icon-cogs", view: section + "/edit/" + 1235, children: [], expanded: false, level: 1, defaultAction: "create"  },
							{ name: "Archieve", id: 1236, icon: "icon-folder-close", view: section + "/edit/" + 1236, children: [], expanded: false, level: 1, defaultAction: "create"  },
							{ name: "Recycle Bin", id: 1237, icon: "icon-trash", view: section + "/trash/view/", children: [], expanded: false, level: 1, defaultAction: "create"  }
						]
					};
					break;

					case "developer":
					t = {
						name: section,
						alias: section,

						children: [
						{ name: "Data types", id: 1234, icon: "icon-folder-close", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 },
						{ name: "Macros", id: 1235, icon: "icon-folder-close", view: section + "/edit/" + 1235, children: [], expanded: false, level: 1 },
						{ name: "Pacakges", id: 1236, icon: "icon-folder-close", view: section + "/edit/" + 1236, children: [], expanded: false, level: 1 },
						{ name: "XSLT Files", id: 1237, icon: "icon-folder-close", view: section + "/edit/" + 1237, children: [], expanded: false, level: 1 },
						{ name: "Razor Files", id: 1237, icon: "icon-folder-close", view: section + "/edit/" + 1237, children: [], expanded: false, level: 1 }
						]
					};
					break;
					case "settings":
					t = {
						name: section,
						alias: section,

						children: [
						{ name: "Stylesheets", id: 1234, icon: "icon-folder-close", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 },
						{ name: "Templates", id: 1235, icon: "icon-folder-close", view: section + "/edit/" + 1235, children: [], expanded: false, level: 1 },
						{ name: "Dictionary", id: 1236, icon: "icon-folder-close", view: section + "/edit/" + 1236, children: [], expanded: false, level: 1 },
						{ name: "Media types", id: 1237, icon: "icon-folder-close", view: section + "/edit/" + 1237, children: [], expanded: false, level: 1 },
						{ name: "Document types", id: 1237, icon: "icon-folder-close", view: section + "/edit/" + 1237, children: [], expanded: false, level: 1 }
						]
					};
					break;
					default: 
					t = {
						name: section,
						alias: section,

						children: [
						{ name: "random-name-" + section, id: 1234, icon: "icon-home", defaultAction: "create", view: section + "/edit/" + 1234, children: [], expanded: false, level: 1 },
						{ name: "random-name-" + section, id: 1235, icon: "icon-folder-close", defaultAction: "create", view: section + "/edit/" + 1235, children: [], expanded: false, level: 1 },
						{ name: "random-name-" + section, id: 1236, icon: "icon-folder-close", defaultAction: "create", view: section + "/edit/" + 1236, children: [], expanded: false, level: 1 },
						{ name: "random-name-" + section, id: 1237, icon: "icon-folder-close", defaultAction: "create", view: section + "/edit/" + 1237, children: [], expanded: false, level: 1 }
						]
					};
					break;
				}				

				treeArray[cacheKey] = t;
				return treeArray[cacheKey];
			},

			getActions: function(treeItem, section){
				return [
				{ name: "Create", cssclass: "plus", alias: "create" },

				{ seperator: true, name: "Delete", cssclass: "remove", alias: "delete" },
				{ name: "Move", cssclass: "move",  alias: "move" },
				{ name: "Copy", cssclass: "copy", alias: "copy" },
				{ name: "Sort", cssclass: "sort", alias: "sort" },
				
				{ seperator: true, name: "Publish", cssclass: "globe", alias: "publish" },
				{ name: "Rollback", cssclass: "undo", alias: "rollback" },
				
				{ seperator: true, name: "Permissions", cssclass: "lock", alias: "permissions" },
				{ name: "Audit Trail", cssclass: "time", alias: "audittrail" },
				{ name: "Notifications", cssclass: "envelope", alias: "notifications" },

				{ seperator: true, name: "Hostnames", cssclass: "home", alias: "hostnames" },
				{ name: "Public Access", cssclass: "group", alias: "publicaccess" },
				
				{ seperator: true, name: "Reload", cssclass: "refresh", alias: "users" }
				];
			},	

			getChildActions: function(options){

				if(options === undefined){
					options = {};
				}
				var section = options.section || 'content';
				var treeItem = options.node;

				return [
				{ name: "Create", cssclass: "plus", alias: "create" },

				{ seperator: true, name: "Delete", cssclass: "remove", alias: "delete" },
				{ name: "Move", cssclass: "move",  alias: "move" },
				{ name: "Copy", cssclass: "copy", alias: "copy" },
				{ name: "Sort", cssclass: "sort", alias: "sort" },
				
				{ seperator: true, name: "Publish", cssclass: "globe", alias: "publish" },
				{ name: "Rollback", cssclass: "undo", alias: "rollback" },
				
				{ seperator: true, name: "Permissions", cssclass: "lock", alias: "permissions" },
				{ name: "Audit Trail", cssclass: "time", alias: "audittrail" },
				{ name: "Notifications", cssclass: "envelope", alias: "notifications" },

				{ seperator: true, name: "Hostnames", cssclass: "home", alias: "hostnames" },
				{ name: "Public Access", cssclass: "group", alias: "publicaccess" },
				
				{ seperator: true, name: "Reload", cssclass: "refresh", alias: "users" }
				];
			},

			getChildren: function (options) {

				if(options === undefined){
					options = {};
				}
				var section = options.section || 'content';
				var treeItem = options.node;

				var iLevel = treeItem.level + 1;

				//hack to have create as default content action
				var action;
				if(section === "content"){
					action = "create";
				}

				return [
					{ name: "child-of-" + treeItem.name, id: iLevel + "" + 1234, icon: "icon-file-alt", view: section + "/edit/" + iLevel + "" + 1234, children: [], expanded: false, level: iLevel, defaultAction: action },
					{ name: "random-name-" + section, id: iLevel + "" + 1235, icon: "icon-file-alt", view: section + "/edit/" + iLevel + "" + 1235, children: [], expanded: false, level: iLevel, defaultAction: action  },
					{ name: "random-name-" + section, id: iLevel + "" + 1236, icon: "icon-file-alt", view: section + "/edit/" + iLevel + "" + 1236, children: [], expanded: false, level: iLevel, defaultAction: action  },
					{ name: "random-name-" + section, id: iLevel + "" + 1237, icon: "icon-file-alt", view: "common/legacy/1237?p=" + encodeURI("developer/contentType.aspx?idequal1234"), children: [], expanded: false, level: iLevel, defaultAction: action  }
				];
			}
		};
	});

return angular;
});