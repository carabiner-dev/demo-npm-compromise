# Google OSS Rebuild Tutorial

> [!NOTE]
> This document expands on the short instructions in the [README](README.md)
> with details on how the OSS Rebuild example is structured. Start there if
> you want a shorter version.

This tutorial runs manually through each step required to run the TL;DR
in the README but instead of relying on AMPEL's capabilities and the data
published in the PolicySet, we generate everything by hand.

The goal is to show various key concepts of the AMPEL policy engine applied
to a practical case: verifying npm packages using Google's[^1]
[OSS Rebuild](https://github.com/google/oss-rebuild) attestations.

[^1]: Carabiner Systems is in no way affiliated with Google Inc. This project
only uses publicly available data.

We hope you have fun! 🥳

## Running this Tutorial

You can run the verification examples in this tutorial downloading only the
[latest AMPEL binary](https://github.com/carabiner-dev/ampel/releases) and
following the instructions to execute the policy. Each steps also provides
instructions to verify your own project. To run through all steps in full,
we recommend you install the following tools:

- [AMPEL](https://github.com/carabiner-dev/ampel)
- [bnd](https://github.com/carabiner-dev/bnd)
- [jq](https://jqlang.org/)
- [gsutil](https://cloud.google.com/storage/docs/gsutil_install)

## The OSS Rebuild PolicySet

We have written an example 
[PolicySet to verify any npm manged projects](https://github.com/carabiner-dev/examples/tree/main/oss-rebuild). To check a project, the policy performs these tasks:

1. Ingests the project's SBOM.
1. Extracts all the npm dependencies from the SPDX manifest.
1. Filters out the whole list of packages, selecting those that have data published in Google's OSS Rebuild.
1. Verifies each of the policy's tenets against each dependency.
1. Finally assembles a result set and asserts the PolicySet.

Let's go though each step in depth to understand how verification works.

## Requirements to Verify the Project

> [!IMPORTANT]
> As shown in the [README TL;DR](README.md), all of these requirements can be
> handled automatically by AMPEL or are already embedded in the PolicySet code.
> We are generating them here to show how everything works internally :)

For this tutorial, we will use the
[v1.0 release](https://github.com/carabiner-dev/demo-npm-compromise/releases/tag/v1.0)
of this repository. If you have an npm project, you can use yours by following
the instructions in each step.

### It All Starts With The SBOM

The SBOM is the main and only required attestation to run the `oss-rebuild`
PolicySet.

We will use AMPEL's subject chaining to apply the policy contained in the set
to all the projects dependencies. Subject chaining is a very powerful feature
that lets AMPEL mutate the original subject under verification to apply the
policy to another artifact securely linked through attested data, in this
case each of the project's dependencies.

#### How Subject Chaining Works

From the SBOM data, the PolicySet selectors will extract all packages and
synthesize new _subjects_, that is new artifacts that will be chained to the
original subject under verification:

```mermaid
```

Once the PolicySet computes its chain, its policies will be applied to each new
subject. The computed evidence chain is preserved and is recorded in the resulting
ResultSet in case it is needed to check the results or perform an audit.

#### Generate the SBOM

For the example repo here, you can use the signed SPDX SBOM published in the
releases. If you want to generate the SBOM for your own npm project, run the
following commands (requires npm 18+):

```bash
npm install
npm sbom --sbom-format=spdx > myproject.spdx.json
```

### Determining Which Packages to Check

Google OSS Rebuild does not have attestations for all npm packages. This means
that we need to fail the policy only for those packages that _should_ have data
but don't have an attestation or there is a mismatch with the rebuild predicate.

#### Generate the Pacakge List

To tell the policy which packages it should check, we need to pass AMPEL an
inventory of the packages being rebuilt by OSS Rebuild. We will build it by
listing Google's OSS Rebuild bucket.

You can see an example we've previously generated in our
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

We also published this bash code
[in a script](https://github.com/carabiner-dev/examples/blob/main/oss-rebuild/build-context.sh)
you can just download and run.

This command extracts all the package names for which OSS Rebuild has published
attestations. We will use this data to tell AMPEL which packages it needs to
look at.

> [!NOTE]
> The PolicySet we've published embeds the list. Generating it yourself means the
> package list will include the latest rebuilt packages.

#### Passing Contextual Data to AMPEL

AMPEL can read contextual data from various sources. You can pass values with
the `-x` flag, through environment variables or specifying it in a JSON file. We
will use the JSON file to run the evaluation.

Alternatively, you can also "bake" the contextual data in the policy code
(as you can see in the
[PolicySet context code](https://github.com/carabiner-dev/examples/blob/645bad3901e8f5817f8b93b816be0625619c85c7/oss-rebuild/policyset.ampel.json#L7)),
this has the added benefit of making it immutable when you sign the policy file.

### Verifying Google's SLSA Attestations

The attestations published by google's OSS Rebuild project are signed with a
fixed key and in an DSSE envelope. We need to supply AMPEL the key to check
the signatures.

Download the key from the examples repository, we'll feed it to AMPEL when we
run the verifier:

https://github.com/carabiner-dev/examples/blob/main/oss-rebuild/rebuild.key

> [!NOTE]
> The PolicySet we've published already 
> [embeds the key identity](https://github.com/carabiner-dev/examples/blob/645bad3901e8f5817f8b93b816be0625619c85c7/oss-rebuild/policyset.ampel.json#L111-L114).
> We are showing how to use the file for illustration purposes.

## Run the Project Verification

Now that we have the SBOM data and the contextual data definition, we can run
the policy. Assuming you are checking v1.0 of this project, execute the following
command:

```bash
# Use your own SBOM or download the v1.0 SBOM from this repo:
curl -L https://github.com/carabiner-dev/demo-npm-compromise/releases/download/v1.1/colortask-v1.0.spdx.json > colortask-v1.0.spdx.json

ampel verify sha1:9b890a2457318c91ae5ed9451a4da74a092db084 \
    --policy "git+https://github.com/carabiner-dev/examples#oss-rebuild/policyset.ampel.json" \
    --attestation colortask-v1.0.spdx.json \
    --context-json=@packages.json \
    --collector ossrebuild: \
    --key rebuild.key
```

Running this on this repo's v1.0 SBOM should show something like this:

```
+-------------------------------------------------------------------------------------------------------------------------------------+
| ⬤⬤⬤AMPEL: Evaluation Results                                                                                                        |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
| PolicySet                        | oss-rebuild-sbom | Date   | 2025-09-24 00:04:35.236667 -0600 CST                                 |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
| Status: ● FAIL                   | Subject          | - sha1:9b890a245...                                                               |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
| Policy                           | Controls         | Status | Details                                                              |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
| oss-rebuild-artifact-equivalence | -                | ● FAIL | required attestations missing to verify subject                      |
|                                  |                  |        | Missing attestations to evaluate the policy on chalk [sha512:ecdcc1] |
+----------------------------------+------------------+--------+----------------------------------------------------------------------+
```

The PolicySet returns __🔴 FAIL__ because because there is no build attestation
for the vulnerable Chalk version. Now lets try running the same command, this
time using the v1.1 version:

```bash
# Use your own SBOM or download v1.1 from this repo:
curl -L https://github.com/carabiner-dev/demo-npm-compromise/releases/download/v1.1/colortask-v1.1.spdx.json > colortask-v1.1.spdx.json

ampel verify sha1:9986a7e5b0b666e4c792f1339bfb9098c4ef8aef \
    --policy "git+https://github.com/carabiner-dev/examples#oss-rebuild/policyset.ampel.json" \
    --attestation colortask-v1.1.spdx.json \
    --context-json=@packages.json \
    --collector ossrebuild: \
    --key rebuild.key
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

### The Verifier Flags

If you read through the quick intro in the [README](README.md), you'll notice
two main differences, this example uses `--attestation` and `--context-json`.
Here's what these flags do:

Using `--attestation` tells ampel to ingest a specific attestation from a file.
Specifying attestations with `-a|--attestation` avoids using a collector and
also allows you to specify unsigned statements you want to associate with the
subject under verification (such as the unsigned SBOM in this example).

Then we use `--context-json` to pass the contextual data generated from Google's
bucket. The flag takes a string of JSON data to use as context or, as in this
example, you can prefix it prefixing it with @ to signal AMPEL it should read the
data from a file instead of parsing the string as JSON.

Finally, we use `-key` to pass AMPEL the public key to verify Google's attestations.

> [!IMPORTANT]
> While the policy set includes the package list embedded in it, it is used
> as a `default`. When you specify fresher data in the command line, it
> overrides the PolicySet's default.

## White Listing Packages

Unfortunately, not all packages are reproducible and some versions are missing
in the OSS Rebuild repo. If you are using a package which you know is safe but
failed to rebuild, you can white list it.

Accute observers probably noticed that the Policy we are using includes two
tenets and
[its assert mode is `OR`](https://github.com/carabiner-dev/examples/blob/645bad3901e8f5817f8b93b816be0625619c85c7/oss-rebuild/policyset.ampel.json#L99-L102):

```json
    "meta": {
        "assert_mode": "OR",
        "description": "Validate package with an OSS Rebuild ArtifactEquivalence attestation"
    }
```

If you look at the
[code of the second tenet](https://github.com/carabiner-dev/examples/blob/645bad3901e8f5817f8b93b816be0625619c85c7/oss-rebuild/policyset.ampel.json#L128C17-L131C18),
you'll see the white list rule:

```json
    {
        "code": " subject.name in context.whitelist ",
        "assessment": {  "message": "Package {{ .Subject.Name }} whitelisted" }
    }
```

This CEL code instructs AMPEL to check for the subject's name, ie the package
name extracted from the SBOM, in the context value named `whitelist`.

As we saw earlier, the context value can be defined in a number of ways. The
simplest is simply passing the value definition in the command line. So if you
need to whitelist a package, you'd run the verifier with the `-x|--context` flag:

```bash
ampel verify sha1:9b890a2457318c91ae5ed9451a4da74a092db084 \
    --policy "git+https://github.com/carabiner-dev/examples#oss-rebuild/policyset.ampel.json" \
    --attestation colortask-v1.0.spdx.json \
    --context-json=@packages.json \
    --collector ossrebuild: \
    --context="whitelist:mypackage"
```

You can also add the package list to the json file or, better yet, write your
own PolicySet referencing the original and signing it to "bake" the packages in
the signed code.

## Conclusion

You probaly noticed that this example uses more flags and files than the TLDR in the
README. We wanted to illustrate how the data packed in the policy code, AMPEL's
capabilities to fetch and verify data allow for simpler verification scenarios.

In the short version, you don't need to worry about downloading data, managing
public keys, generating contextual information. Everything is handled by AMPEL
automatically or packed in the PolicySet code.
