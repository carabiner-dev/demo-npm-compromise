# Compromised NPM Package Example

⚠️ __THIS CODE IS A SECURITY EXAMPLE. NOT FOR GENERAL USE__ ⚠️

This is an example JS app to demo how [AMPEL](https://github.com/carabiner-dev)
can help protect against package repository compromises using
[Google's OSS Rebuild](https://github.com/google/oss-rebuild) attestations.

This example uses as an example the
[September 2025 npm package compromise](https://www.aikido.dev/blog/npm-debug-and-chalk-packages-compromised)
when stolen registry credentials were used to push packages to the npm registry
with malware injected after checking out the original source.

## The Sample App Code

This repository contains an app built with a single dependency: [Chalk](https://www.npmjs.com/package/chalk).
This module was part of the npm registry comprimise incident, v5.6.1 (now removed)
had malware in it and v5.6.2 was pushed to fix it.

In the releases page you will find release v1.0 which contains the vulnerable package.
We will apply an ampel policy to detect the compromised package and use release v1.1
to verify the policy passes with the fixed version.

## Running this Tutorial

You can run the verifications in this tutorial downloading only the latest AMPEL
binary and following the instructions to execute the policy. We also provide
instructions to verify your own project if you prefer.

### Requirements

To just run the verification on the test data, you will only need the latest AMPEL
binary. If you want to follow more deeply, we recommend you install the following
tools:

- [AMPEL](https://github.com/carabiner-dev/ampel)
- [bnd](https://github.com/carabiner-dev/bnd)
- [jq](https://jqlang.org/)
- [gsutil](https://cloud.google.com/storage/docs/gsutil_install)

## Verifying the Affected Release

We have written an example policy to verify any npm manged projects. To check a
project, the policy roughly performs these tasks:

1. Ingests the project's SBOM.
1. Extracts all the npm dependencies from the SPDX manifest.
1. Filters out the whole list of packages, selecting those that have data published in Google's OSS Rebuild.
1. Verifies each of the policy's tenets against each dependency.
1. Finally assembles a result set and asserts the PolicySet.

Let's go though each step in deep to understand how verification works.

### Verify the Project

For this tutorial, we will use the v1.0 release of this repository. If you have
an npm project, you can use yours if you prefer by following the instructions
in each step.

#### It All Starts With The SBOM

The SBOM is the main and only required attestation to run the `oss-rebuild` policyset.

We will use AMPEL's subject chaining to apply the policy to all the projects
dependencies. Subject chaining is a very power feature that lets AMPEL mutate
the original subject under verification to apply the policy to another artifact
securely linked through attested data.

##### How Subject Chaining Works

From the SBOM data, the PolicySet selectors will extract all packages and
synthesize new _subjects_, that is new artifacts that will be chained to the
original subject under verification:

```mermaid
```

Once the PolicySet computes its chain, its policies will be applied to each new
subject. The computed evidence chain is preserved and is recorded in the resulting
ResultSet in case it is needed to check the results or perform an audit.

##### Generate the SBOM

For the example repo here, you can use the v1.0 release SPDX SBOM. If you want to
generate the SBOM for your own npm project run the following command (requires npm 18+):

```bash
npm install
npm sbom --sbom-format=spdx > myproject.spdx.json
```

#### Determining Which Packages to Check

Google OSS Rebuild does not have attestations for all npm packages. This means
that we need to fail the policy for those packages who _should_ have data but
don't have an attestation or there is a mismatch with the rebuild data.

##### Generate the Pacakge List

To tell the policy which packages it should check, we need to pass AMPEL a list.
We will build it by reading the data from Google's OSS Rebuild bucket. If you
don't want to generate it, we have it already generated in our
[examples repository](https://github.com/carabiner-dev/examples/tree/main/oss-rebuild).

If you want to generate the data yourself, you can use `gsutil` and `jq` to
read the GCS bucket contents and generate the list:

```bash
for n in $(gsutil ls gs://google-rebuild-attestations/npm/ | awk -F / '{print $(NF-1)}'); 
    do if [[ $n != "@"* ]]; 
    then echo $n; 
    else for s in $(gsutil ls "gs://google-rebuild-attestations/npm/$n" | awk -F/ '{print $(NF-1)}'); 
        do echo "$n/$s"; done;
    fi;
done | jq -Rs '{packages: split("\n") | map(select(length > 0))}' > packages.json
```

We also have this bash code
[published in a script](https://github.com/carabiner-dev/examples/blob/main/oss-rebuild/build-context.sh) you can download and run.

This command extracts all the package names for which OSS Rebuild has published
attestations. We will use this data to tell AMPEL which packages it needs to
look at.

##### Passing Contextual Data to AMPEL

AMPEL can read contextual data from various sources. You can pass values with
the `-x` flag, through environment variables or specifying it in a JSON file. We
will use the JSON file to run the evaluation.

Alternatively, you can also "bake" the contextual data in the policy code, this
has the added benefit of making it immutable when you sign the policy file.

#### Run the Project Verification

Now that we have the SBOM data and the contextual data definition, we can run
the policy. Assuming you are checking v1.0 of this project, execute the following
command:

```bash
curl -L https://github.com/carabiner-dev/examples-colortask/releases/download/v1.1/colortask-v1.0.spdx.json > colortask-v1.0.spdx.json

ampel verify sha1:9b890a2457318c91ae5ed9451a4da74a092db084 \
    --policy "git+https://github.com/carabiner-dev/examples#oss-rebuild/policyset.ampel.json" \
    --attestation colortask-v1.0.spdx.json \
    --context-json=@packages.json \
    --collector ossrebuild:  
```

Let's go through each flag to understand what it does:

First `ampel verify sha1:12234` tells ampel to verify an artifact. In this case
we are using the commit sha1 digest as the subject artifact.

The `--policy` flag tells ampel to pull and use the oss rebuild policy stored 
in the examples repository. Since we are not using a commit in the policy locator,
ampel will pull the latest revision.

Using `--attestation` tells ampel to ingest a specific attestation from a file.
Specifying attestations with `-a|--attestation` avoids using a collector and
also allows you to specify unsigned statements you want to associate with the
subject under verification (such as the unsigned sbom in this example).

The we use `--context-json` to pass the contextual data. The flag takes a string
of JSON data to use as context. In this example, we are prefixing it with @ to
indicate AMPEL it should read from a file instead of parsing the string as JSON.

Finally, we instruct AMPEL to configure an `ossrebuild` repository collector in
the collector agent. This is a collector driver that knows how to read data
from Google's OSS Rebuild Attestation bucket.

Running this on the v1.0 SBOM should show something like this:

```
+-------------------------------------------------------------------------------------------------------------------------------------+
| ⬤⬤⬤AMPEL: Evaluation Results                                                                                                        |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
| PolicySet                        | oss-rebuild-sbom | Date   | 2025-09-24 00:04:35.236667 -0600 CST                                 |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
| Status: ● FAIL                   | Subject          | - sha1:12234...                                                               |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
| Policy                           | Controls         | Status | Details                                                              |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
| oss-rebuild-artifact-equivalence | -                | ● FAIL | required attestations missing to verify subject                      |
|                                  |                  |        | Missing attestations to evaluate the policy on chalk [sha512:ecdcc1] |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
```

The policyset fails because because there is no build attestation for the vulnerable
chalk version. Now lets try running the same command, this time using the v1.1 version:

```
curl -L https://github.com/carabiner-dev/examples-colortask/releases/download/v1.1/colortask-v1.1.spdx.json > colortask-v1.1.spdx.json

ampel verify sha1:9986a7e5b0b666e4c792f1339bfb9098c4ef8aef \
    --policy "git+https://github.com/carabiner-dev/examples#oss-rebuild/policyset.ampel.json" \
    --attestation colortask-v1.1.spdx.json \
    --context-json=@packages.json \
    --collector ossrebuild:  
```

This should verify the project as AMPEL fetches and verifies the signed build
attestation from OSS Rebuild:

```
+-------------------------------------------------------------------------------------------------------------------------+
| ⬤⬤⬤AMPEL: Evaluation Results                                                                                            |
+----------------------------------+------------------+--------+----------------------------------------------------------+
| PolicySet                        | oss-rebuild-sbom | Date   | 2025-09-23 23:35:11.79715 -0600 CST                      |
+----------------------------------+------------------+--------+----------------------------------------------------------+
| Status: ● PASS                   | Subject          | - sha1:12234...                                                   |
+----------------------------------+------------------+--------+----------------------------------------------------------+
| Policy                           | Controls         | Status | Details                                                  |
+----------------------------------+------------------+--------+----------------------------------------------------------+
| oss-rebuild-artifact-equivalence | -                | ● PASS | Package chalk build verified through ArtifactEquivalence |
+----------------------------------+------------------+--------+----------------------------------------------------------+
```
