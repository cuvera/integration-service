import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

// Azure AD app registration config
const config = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID as string,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET as string,
  },
};
async function getAccessToken(): Promise<string> {
  const cca = new ConfidentialClientApplication(config);

  const result = await cca.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"], // .default uses all app perms granted in portal
  });

  if (!result) {
    throw new Error("Could not acquire access token");
  }

  return result.accessToken;
}

function getGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// Fetch calendar events for a specific user
export async function getUserCalendar(userPrincipalName: string) {
  const token = await getAccessToken();
  console.log("Access token (first 100 chars):", token.substring(0, 100));
  const decoded = JSON.parse(Buffer.from(   token.split('.')[1]   , 'base64').toString());
  console.log("Token roles:", decoded.roles);
  console.log("Token audience:", decoded.aud);
  const client = getGraphClient(token);

  const events = await client
    .api(`/users/${userPrincipalName}/calendar/events`)
    .select("subject,start,end,organizer")
    .top(10) // get first 10 events
    .get();

  return events.value;
}

// Fetch list of all users in tenant
export async function getAllUsers() {
  const token = await getAccessToken();
  const client = getGraphClient(token);

  const users = await client.api("/users").select("id,displayName,mail,userPrincipalName").top(50).get();
  return users.value;
}
