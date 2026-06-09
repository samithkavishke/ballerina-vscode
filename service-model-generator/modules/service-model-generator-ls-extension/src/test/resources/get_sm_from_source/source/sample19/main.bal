import ballerinax/trigger.hubspot;

listener hubspot:Listener hubspotListener = new (listenerConfig = {clientSecret: "secret", callbackURL: "http://localhost:8090/callback"});

service hubspot:CompanyService on hubspotListener {
    remote function onCompanyCreation(hubspot:WebhookEvent event) returns error? {
        do {
        } on fail error err {
            // handle error
            return error("unhandled error", err);
        }
    }

    remote function onCompanyDeletion(hubspot:WebhookEvent event) returns error? {
        do {
        } on fail error err {
            // handle error
            return error("unhandled error", err);
        }
    }

    remote function onCompanyPropertychange(hubspot:WebhookEvent event) returns error? {
        do {
        } on fail error err {
            // handle error
            return error("unhandled error", err);
        }
    }
}
