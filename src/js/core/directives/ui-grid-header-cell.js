(function(){

angular.module('ui.grid').directive('uiGridHeaderCell', ['$log', '$timeout', '$window', 'gridUtil', 'uiGridConstants', function ($log, $timeout, $window, gridUtil, uiGridConstants) {
  // Do stuff after mouse has been down this many ms on the header cell
  var mousedownTimeout = 1000;

  var uiGridHeaderCell = {
    priority: 0,
    scope: {
      col: '=',
      row: '=',
      renderIndex: '='
    },
    require: '?^uiGrid',
    templateUrl: 'ui-grid/uiGridHeaderCell',
    replace: true,
    link: function ($scope, $elm, $attrs, uiGridCtrl) {
      $scope.grid = uiGridCtrl.grid;

      // Hide the menu by default
      $scope.menuShown = false;

      // Store a reference to menu element
      var $colMenu = angular.element( $elm[0].querySelectorAll('.ui-grid-header-cell-menu') );

      // Figure out whether this column is sortable or not
      if (uiGridCtrl.grid.options.enableSorting) {
        if (typeof($scope.col.sortable) !== 'undefined' && $scope.col.sortable !== undefined && $scope.col.sortable === false) {
          $scope.sortable = false;
        }
        else {
          $scope.sortable = true;
        }
      }
      else {
        $scope.sortable = false;
      }

      function handleClick() {
        // TODO(c0bra): add/remove other columns from sorting...
        uiGridCtrl.grid.resetSortPriorities($scope.col);

        // Figure out the sort direction
        if ($scope.col.sort.direction && $scope.col.sort.direction === uiGridConstants.ASC) {
          $scope.col.sort.direction = uiGridConstants.DESC;
        }
        else {
          $scope.col.sort.direction = uiGridConstants.ASC;
        }

        // TODO(c0bra): if there's a SHIFT-key modifier then add this column to the sorting, but don't unset the other ones
        $scope.col.sort.priority = 0;

        // Rebuild the grid's rows
        uiGridCtrl.refreshRows();
      }

      // Long-click (for mobile)
      var cancelMousedownTimeout;
      var mousedownStartTime = 0;
      $elm.on('mousedown', function(evt) {
        mousedownStartTime = (new Date()).getTime();

        cancelMousedownTimeout = $timeout(function() { }, mousedownTimeout);

        cancelMousedownTimeout.then(function () {
          $scope.menuShown = !$scope.menuShown;
        });
      });

      // Show or hide the menu
      function toggleMenu() {
        if ($scope.menuShown) {
          // If the menu is visible, hide it
          $scope.menuShown = false;
        }
        else {
          /* Move the menu to right below this header cell */

          // Get hea header cell's location
          var rect = $elm[0].getBoundingClientRect();
          var top = rect.top,
              left = rect.left;

          var height = gridUtil.elementHeight($elm);
          var width = gridUtil.elementWidth($elm);

          $colMenu[0].offsetTop = top + height;
          $colMenu[0].offsetLeft = left + width;

          // Show the menu for this column
          $scope.menuShown = true;
        }
      }

      function hideMenu () { $scope.menuShown = false; }
      $window.addEventListener('resize', hideMenu);

      // If this column is sortable, add a click event handler
      if ($scope.sortable) {
        $elm.on('click', function() {
          $timeout.cancel(cancelMousedownTimeout);

          var mousedownEndTime = (new Date()).getTime();
          var mousedownTime = mousedownEndTime - mousedownStartTime;

          if (mousedownTime > mousedownTimeout) {
            $log.debug('long click!');
          }
          else {
            $log.debug('short click!');
            handleClick();
          }
        });

        $scope.$on('$destroy', function () {
          // Cancel any pending long-click timeout
          $timeout.cancel(cancelMousedownTimeout);

          // Unbind from window resize events
          $window.removeEventListener('resize', hideMenu);
        });
      }
    }
  };

  return uiGridHeaderCell;
}]);

})();