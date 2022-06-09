import { PageTitle } from "@/components/common/PageTitle";
import EnvVarList, { EnvVarPair } from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useOverflowListener } from "@/hooks/useOverflowListener";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { RouteName, siteMap } from "@/routingConfig";
import { Project } from "@/types";
import deleteProject from "@/utils/delete-project";
import { toQueryString } from "@/utils/routing";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  isValidEnvironmentVariableName,
} from "@/utils/webserver-utils";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import { Dialog, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import { Link } from "react-router-dom";

type RoutePath = Extract<RouteName, "pipeline" | "jobs" | "environments">;

const ProjectSettingsView: React.FC = () => {
  // global states

  const {
    setAlert,
    setAsSaved,
    state: { hasUnsavedChanges },
  } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.projectSettings.path });
  const { cancelableFetch } = useCancelableFetch();

  // data from route
  const { navigateTo, projectUuid } = useCustomRoute();

  const { state: projectsState, dispatch } = useProjectsContext();

  const [envVariables, _setEnvVariables] = React.useState<
    EnvVarPair[] | undefined
  >(undefined);
  const setEnvVariables = (
    value: React.SetStateAction<EnvVarPair[] | undefined>
  ) => {
    _setEnvVariables(value);
    setAsSaved(false);
  };

  // local states
  const [state, setState] = React.useState<
    Pick<Project, "pipeline_count" | "job_count" | "environment_count" | "path">
  >({
    pipeline_count: 0,
    job_count: 0,
    environment_count: 0,
    path: "",
  });

  const [isDeletingProject, setIsDeletingProject] = React.useState(false);

  const returnToProjects = (e: React.MouseEvent) => {
    navigateTo(siteMap.projects.path, undefined, e);
  };

  const saveGeneralForm = (e) => {
    e.preventDefault();

    let envVariablesObj = envVariablesArrayToDict(envVariables || []);
    // Do not go through if env variables are not correctly defined.
    if (envVariablesObj.status === "rejected") {
      setAlert("Error", envVariablesObj.error);
      return;
    }

    // Validate environment variable names
    for (let envVariableName of Object.keys(envVariablesObj.value)) {
      if (!isValidEnvironmentVariableName(envVariableName)) {
        setAlert(
          "Error",
          `Invalid environment variable name: "${envVariableName}".`
        );
        return;
      }
    }

    // perform PUT to update; don't cancel this PUT request
    fetcher(`/async/projects/${projectUuid}`, {
      method: "PUT",
      headers: HEADER.JSON,
      body: JSON.stringify({ env_variables: envVariablesObj.value }),
    })
      .then(() => {
        setAsSaved();
      })
      .catch((response) => {
        console.error(response);
      });
  };

  useOverflowListener();

  const fetchSettings = () => {
    cancelableFetch<Project>(`/async/projects/${projectUuid}`)
      .then((result) => {
        const {
          env_variables,
          pipeline_count,
          job_count,
          environment_count,
          path,
        } = result;

        _setEnvVariables(envVariablesDictToArray(env_variables));
        setState((prevState) => ({
          ...prevState,
          pipeline_count,
          job_count,
          environment_count,
          path,
        }));
      })
      .catch(console.log);
  };

  React.useEffect(() => {
    fetchSettings();
  }, []);

  const { setConfirm } = useAppContext();
  const deleteCurrentProject = () => {
    if (!projectUuid) {
      return;
    }
    setConfirm(
      `Delete ${state.path}?`,
      "Warning: Deleting a Project is permanent. All associated Jobs and resources will be deleted and unrecoverable.",
      async (resolve) => {
        setIsDeletingProject(true);
        try {
          await deleteProject(projectUuid);
          if (projectsState.projectUuid === projectUuid) {
            dispatch({ type: "SET_PROJECT", payload: undefined });
          }

          navigateTo(siteMap.projects.path);
        } catch (error) {
          setAlert(
            "Error",
            `Failed to delete the project with UUID ${projectUuid}`
          );
          console.error(
            `Failed to delete the project with UUID ${projectUuid}. ${error}`
          );
        } finally {
          resolve(true);
          setIsDeletingProject(false);
          return true;
        }
      },
      true
    );
  };

  const paths = React.useMemo(() => {
    const paths = ["pipeline", "jobs", "environments"] as RoutePath[];
    return paths.reduce((all, curr) => {
      return {
        ...all,
        [curr]: `${siteMap[curr].path}${toQueryString({ projectUuid })}`,
      };
    }, {} as Record<RoutePath, string>);
  }, [projectUuid]);

  return (
    <Layout>
      <Dialog open={isDeletingProject}>
        <Box
          sx={{
            p: 4,
          }}
        >
          <Typography variant="h5">Deleting project...</Typography>
          <Box sx={{ marginTop: 4 }}>
            <LinearProgress />
          </Box>
        </Box>
      </Dialog>
      <div className={"view-page view-project-settings"}>
        <form
          className="project-settings-form"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="push-down">
            <Button
              color="secondary"
              startIcon={<ArrowBackIcon />}
              onClick={returnToProjects}
              onAuxClick={returnToProjects}
            >
              Back to projects
            </Button>
          </div>

          <PageTitle>Project settings</PageTitle>

          {envVariables ? (
            <>
              <div className="project-settings trigger-overflow">
                <div className="columns four push-down top-labels">
                  <div className="column">
                    <label>Project</label>
                    <h3>{state.path}</h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <Link to={paths.pipeline} className="text-button">
                        {state.pipeline_count +
                          " " +
                          (state.pipeline_count == 1
                            ? "pipeline"
                            : "pipelines")}
                      </Link>
                    </h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <Link to={paths.jobs} className="text-button">
                        {state.job_count +
                          " " +
                          (state.job_count == 1 ? "job" : "jobs")}
                      </Link>
                    </h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <Link to={paths.environments} className="text-button">
                        {state.environment_count +
                          " " +
                          (state.environment_count == 1
                            ? "environment"
                            : "environments")}
                      </Link>
                    </h3>
                  </div>
                  <div className="clear"></div>
                </div>

                <h3 className="push-down">Project environment variables</h3>

                <EnvVarList
                  value={envVariables}
                  setValue={setEnvVariables}
                  data-test-id="project"
                />
              </div>
              <div className="bottom-buttons observe-overflow">
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={saveGeneralForm}
                  data-test-id="project-settings-save"
                >
                  {hasUnsavedChanges ? "SAVE*" : "SAVE"}
                </Button>
              </div>
              <div className="bottom-buttons observe-overflow">
                <Button
                  variant="contained"
                  startIcon={<DeleteIcon />}
                  onClick={deleteCurrentProject}
                  color="error"
                  data-test-id="pipeline-settings-delete"
                >
                  DELETE PROJECT
                </Button>
              </div>
            </>
          ) : (
            <LinearProgress />
          )}
        </form>
      </div>
    </Layout>
  );
};

export default ProjectSettingsView;
