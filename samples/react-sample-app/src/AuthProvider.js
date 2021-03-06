import React, { useEffect, useState } from "react";
import {
  msalApp,
  requiresInteraction,
  fetchMsGraph,
  isIE,
  GRAPH_ENDPOINTS,
  GRAPH_SCOPES,
  GRAPH_REQUESTS
} from "./auth-utils";

// If you support IE, our recommendation is that you sign-in using Redirect APIs
const useRedirectFlow = isIE();
// const useRedirectFlow = true;

const AuthProvider = Component => {
  const WrappedComponent = props => {
    const [account, setAccount] = useState(null);
    const [error, setError] = useState(null);
    const [emailMessages, setEmailMessages] = useState(null);
    const [graphProfile, setGraphProfile] = useState(null);

    const acquireToken = async (request, redirect) => {
      return msalApp.acquireTokenSilent(request).catch(error => {
        // Call acquireTokenPopup (popup window) in case of acquireTokenSilent failure
        // due to consent or interaction required ONLY
        if (requiresInteraction(error.errorCode)) {
          return redirect
            ? msalApp.acquireTokenRedirect(request)
            : msalApp.acquireTokenPopup(request);
        }
      });
    };

    const onSignIn = async redirect => {
      if (redirect) {
        return msalApp.loginRedirect(GRAPH_REQUESTS.LOGIN);
      }

      const loginResponse = await msalApp
        .loginPopup(GRAPH_REQUESTS.LOGIN)
        .catch(error => {
          setError(error.message);
        });

      if (loginResponse) {
        setAccount(loginResponse.account);
        setError(null);

        const tokenResponse = await acquireToken(GRAPH_REQUESTS.LOGIN).catch(
          error => {
            setError(error.message);
          }
        );

        if (tokenResponse) {
          const graphProfile = await fetchMsGraph(
            GRAPH_ENDPOINTS.ME,
            tokenResponse.accessToken
          ).catch(() => {
            setError("Unable to fetch Graph profile.");
          });

          if (graphProfile) {
            setGraphProfile(graphProfile);
          }

          if (tokenResponse.scopes.indexOf(GRAPH_SCOPES.MAIL_READ) > 0) {
            return readMail(tokenResponse.accessToken);
          }
        }
      }
    };

    const onSignOut = () => {
      msalApp.logout();
    };

    const onRequestEmailToken = async () => {
      const tokenResponse = await acquireToken(
        GRAPH_REQUESTS.EMAIL,
        useRedirectFlow
      ).catch(e => {
        setError("Unable to acquire access token for reading email.");
      });

      if (tokenResponse) {
        return readMail(tokenResponse.accessToken);
      }
    };

    const readMail = async accessToken => {
      const emailMessages = await fetchMsGraph(
        GRAPH_ENDPOINTS.MAIL,
        accessToken
      ).catch(() => {
        setError("Unable to fetch email messages.");
      });

      if (emailMessages) {
        setEmailMessages(emailMessages);
        setError(null);
      }
    };

    useEffect(() => {
      async function performAsync() {
        msalApp.handleRedirectCallback(error => {
          if (error) {
            const errorMessage = error.errorMessage
              ? error.errorMessage
              : "Unable to acquire access token.";
            // setState works as long as navigateToLoginRequestUrl: false
            setError(errorMessage);
          }
        });

        setAccount(msalApp.getAccount(), [account]);

        if (account) {
          const tokenResponse = await acquireToken(
            GRAPH_REQUESTS.LOGIN,
            useRedirectFlow
          );

          if (tokenResponse) {
            const graphProfile = await fetchMsGraph(
              GRAPH_ENDPOINTS.ME,
              tokenResponse.accessToken
            ).catch(() => {
              setError("Unable to fetch Graph profile.");
            });

            if (graphProfile) {
              setGraphProfile(graphProfile);
            }

            if (tokenResponse.scopes.indexOf(GRAPH_SCOPES.MAIL_READ) > 0) {
              return readMail(tokenResponse.accessToken);
            }
          }
        }
      }

      performAsync();
    }, [account]);

    return (
      <Component
        {...props}
        account={account}
        emailMessages={emailMessages}
        error={error}
        graphProfile={graphProfile}
        onSignIn={() => onSignIn(useRedirectFlow)}
        onSignOut={() => onSignOut()}
        onRequestEmailToken={() => onRequestEmailToken()}
      />
    );
  };
  return WrappedComponent;
};

export default AuthProvider;