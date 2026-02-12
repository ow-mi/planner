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
### Import
- add json upload
### Leg
- rename the subtab deadlines tab to legs
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
