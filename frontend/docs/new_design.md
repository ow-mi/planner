# Redesign 
- We are going to make some changes to this project that will affect the:
  - frontend, which we will rename from ui_v2_exp/
  - backend
  - solver, which we will rename from planner_v4/

# frontend
## inputs
- 1 mandatory spreadsheet, uploaded directly or found with the current path input, if there are many .csv or excel files in the given path or uploaded the user must select which one to use.
- 1 optional .json file 
## outputs
- the csv that was input into the solver
- the json that was input into the solver
- plots
- any output data from the solver as csv's

# frontend ui changes
## data tab
- add upload button (as well as the current path upload system)
  - files accepted can be any name, must be csv or excel
- add file selector: if there are many files that have been added via path or upload, the user must select one
- files that are selected must have the headers as defined in the sample_data/new_data_format.csv
- if some are missing or in the wrong format the user must get a message with the problematic column name, or data type inconsistency
## configuration tab
### subtabs arranged
- new subtab called weights
- combines the inputs currently in "Mode and Weights" + "Penalty" + "Weights Slider"
### Import sub tab
- add json upload
### Leg sub tab

- rename the subtab deadlines tab to legs
- leg have a start date (in the 2026-W03.5 format)
- optionally enabled end dates
- each leg can be moved to reorder the list, this could be used to set a priority order later on
### FTE (Full time employee) sub tab
- add new subtab called fte
- the user can add holiday's, with start end dates, several as needed
- the user can add fte's as many as needed, with a name 
- the employee avalabilty can be set, the holiday's are preset but can be overwritten, this must work in a full year calander or cell setup where the user can quickly toggle avalabilty over large periods quickly and easily 
- the user must be able to select a year, and have the calander for that year (one calander section, with section of which year and employee to toggle at that time)
- a grouping input where an alias can be made for several fte's in the test sub tab
  - ie. team_gen3 = fte_1, fte_2, fte_3
  - ie. team_hec = fte_6, fte_10, fte_15
### Employee (Full time employee) sub tab
- add new subtab called FTE
- the same parameters as the FTE tab, but for equipment
### test sub tab
- for every test, the user need to set
  - the fte needed for the test, as a contains string search of the fte
  - the equipment needed for the test, as a contains string search of the equipment
  - the test duration in days
  - the fte_time % and the equipment time % (the % duration from the start of the test where the fte/equipment is needed). ie. 25% fte_time of an 8 week long test = 2 week at the start of the test where the fte is need, after that the fte is no longer needed to run the test, so maybe just equipment is needed for the test to finish the rest
  - an External input (external testing has no need for fte or equipment, but if one is assinged that will override the lack of need for one) (ie. we have test running in an external test lab where we don't need to work, but maybe we need to send a piece of equipment)
- The settings will be in this order
- project -> leg type -> legs -> test_type -> tests 
  - leg_type, test_type are the unique of these, where as project, legs and tests are all of them
  - so project will affect the everything in the project, then if there is a setting in leg_type, that will overwrite the project setting for that value and so on
  - ie. 
    - project: fte set to team_gen3
    - leg: leg_1 set to micky 
    - test_type: leak set to external 
    - tests: the project:gen3, leg: 2, test: P-03 get fte of fte_3
    - here the project setting is applied first, then everything after that overwrites it. So for the gen3 project, the fte=team_gen3, but then for leg_1 of the project the fte=micky (other legs still are set to team_gen3, and so on for other settings)
## solver tab
### Batch
- remove the batch subtab
## Solver
- in the solver, rename the "output folder" input to "run name"
- when we run the solver it will get the currently selected csv + the "Generated JSON Configuration" from the configuration tab
- a new subtab will be made with the name of the "run name"
- the solver will have an "add to queue" and "run all scenario's"
  - when "add to queue is pressed a tab for that configuration is made, the settings are saved there, but the solver is not run yet"
  - when the "run all scenario's is pressed, then all unsolved scenario tabs are run, one after another"
- in each scenario sub tab, there is a "run scenario" to solve just this scenario and simplified streamed plot of the data from the solver
- the solver needs to stream data every so often, so that we can have a basic visualization of the current state
- the solver also needs a stop rendering option, where the current start of the solver is saved (at some point in rendering the solver will take more time for no major benifit)
- runs are solved one at a time until all are complete, they do not run if they have been run before
## visualizer tab
- in the visualizer we need to be able to select which run to visualize, including any runs via uploaded data 


## configuration tab
- The data from the config tab must first be extracted from the input data (csv or excel)
  - this means getting the project, legs, test names
  - these are used to fill the subtabs in the configuration tab as needed. 
  - if the input .json refers to elements that are not in the spreadsheet data, then a notification should be sent, and only things in the spreadsheet should be taken into account.
