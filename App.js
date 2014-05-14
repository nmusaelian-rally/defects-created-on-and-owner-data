Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    
launch: function() {
        var that = this;
   	that._datePick = Ext.create('Ext.panel.Panel',{
	    //title: 'Choose a date:',
	    width: 200,
	    bodyPadding: 10,
   	    items: [
                {
                    xtype: 'datepicker',
                    handler: function(picker, date) {
                        that._onDateSelected(date);
                    }
                },
                {
                    xtype:'container',
                    id: 'notify',
                    html: 'click on a date to select'
                }
            ]
   	});
   	this.add(that._datePick);
   },
   
   _onDateSelected:function(date){
	console.log('date',date);
	var nextDay = Rally.util.DateTime.add(date, "day", 1);
	console.log('nextDay',nextDay);
	var isoDate =  Rally.util.DateTime.toIsoString(date,true);
	var isoNextDay =  Rally.util.DateTime.toIsoString(nextDay,true);
	console.log('isoDate',isoDate);
	console.log('isoNextDay',isoNextDay);
	this._loadDefects(isoDate,isoNextDay);
   },
   
   _loadDefects: function(isoDate,isoNextDay){
        var that = this;
        that._filters = [
            {
                property : 'CreationDate',
                operator : '>=',
                value : isoDate 
            },
            {
                property : 'CreationDate',
                operator : '<',
                value : isoNextDay  
            }
			
   	];
        
        Ext.create('Rally.data.wsapi.Store', {
            model: 'Defect',
            fetch: ['Name','FormattedID','Priority', 'Severity', 'State','CreationDate', 'Owner'],
            autoLoad: true,
            filters: that._filters,
            listeners: {
                load: this._onDataLoaded,
                scope: this
            }
        });
   },
   
   _onDataLoaded: function(store, records){
        if ((records.length === 0) && (this._grid)) {
            this._grid.destroy();
        }
        
        var that = this;
        Ext.getCmp('notify').update(records.length + ' defect(s) created on this day');
        var promises = [];
         _.each(records, function(defect) {
            promises.push(that._getOwner(defect, that));
        });

        Deft.Promise.all(promises).then({
            success: function(results) {
                that._defects = results;
                that._makeGrid();
            }
        });
    },
    
     _getOwner: function(defect, scope) {
        var deferred = Ext.create('Deft.Deferred');
        var that = scope;
        var userOid = defect.get('Owner').ObjectID;
        Rally.data.ModelFactory.getModel({
        type: 'User',
        scope: this,
        success: function(model, operation) {
            fetch: ['UserName','DisplayName','EmailAddress'],
            model.load(userOid, {
                scope: this,
                success: function(record, operation) {
                    var username = 'None';
                    var displayname = 'None';
                    var email =  'None';
                    if (record) {
                        username = record.get('UserName');
                        displayname = record.get('DisplayName');
                        email =  record.get('EmailAddress');
                    }
                    var defectRef = defect.get('_ref');
                    var defectOid  = defect.get('ObjectID');
                    var defectFid = defect.get('FormattedID');
                    var defectName  = defect.get('Name');
                    var defectState = defect.get('State');
                    var defectPriority = defect.get('Priority');
                    var defectSeverity = defect.get('Severity');
                    
                    
                    result = {
                                "_ref"          : defectRef,
                                "ObjectID"      : defectOid,
                                "FormattedID"   : defectFid,
                                "Name"          : defectName,
                                "State"         : defectState,
                                "Owner"         : username,
                                "OwnerName"     : displayname,
                                "OwnerEmail"    : email   
                            };
                    deferred.resolve(result);    
                }
            });
            }
        });
        return deferred; 
    },
   
   _makeGrid: function() {
        var that = this;

        if (that._grid) {
            that._grid.destroy();
        }

        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: that._defects,
            groupField: 'FeatureID',
            pageSize: 1000,
        });

        that._grid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'storyGrid',
            store: gridStore,
            features: [{ftype:'grouping'}],
            columnCfgs: [
                {
                    text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
                    tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                },

                {
                    text: 'Name', dataIndex: 'Name', 
                },
                {
                    text: 'State', dataIndex: 'State', 
                },
                {
                    text: 'Owner', dataIndex: 'Owner',
                },
                {
                    text: 'Owner Name', dataIndex: 'OwnerName',
                },
                {
                    text: 'Owner Email', dataIndex: 'OwnerEmail',
                }
            ]
        });

        that.add(that._grid);
        that._grid.reconfigure(gridStore);
    }
});