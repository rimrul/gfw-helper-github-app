const guessComponentUpdateDetails = (title, body) => {
    let [ , package_name, version ] =
        title.match(/^\[New (\S+) version\] (?:[^0-9]+\s+)?(\S+(?:\s+patch\s+\d+)?)(?! new items)/) ||
        title.match(/^(\S+): update to v?(\d[0-9.]\S*)/) ||
        body.match(/^# \[New (\S+) version\] (?:[^0-9]+\s+)?(\S+(?:\s+patch\s+\d+)?)/) ||
        []
    if (!package_name || !version) throw new Error(`Could not guess component-update details from title '${title}'`)

    if (['git-lfs'].includes(package_name)) package_name = `mingw-w64-${package_name}`
    else if (['gcm-core', 'gcm'].includes(package_name)) package_name = 'mingw-w64-git-credential-manager'
    else if (package_name === 'cygwin') package_name = 'msys2-runtime'

    version = version
        .replace(/^(GCM |openssl-|OpenSSL_|v|V_|GnuTLS |tig-|Heimdal |cygwin-|PCRE2-|Bash-)/, '')
        .replace(/_|\s+patch\s+/, '.')
        .replace(/-release$/, '')

    return { package_name, version }
}

const prettyPackageName = (name) => {
    return {
        'git-credential-manager': 'Git Credential Manager',
        'git-lfs': 'Git LFS',
        'msys2-runtime': 'MSYS2 runtime',
        bash: 'Bash',
        curl: 'cURL',
        gnutls: 'GNU TLS',
        heimdal: 'Heimdal',
        mintty: 'MinTTY',
        openssh: 'OpenSSH',
        openssl: 'OpenSSL',
        pcre2: 'PCRE2',
        perl: 'Perl',
        tig: 'Tig',
    }[name] || name
}

const isMSYSPackage = package_name => {
    return package_name !== 'git-extra'
        && !package_name.startsWith('mingw-w64-')
}

const needsSeparateARM64Build = package_name => {
    if (package_name === 'git-extra') return true
    return package_name.startsWith('mingw-w64-') && ![
        'mingw-w64-git-credential-manager',
        'mingw-w64-git-lfs',
        'mingw-w64-wintoast'
    ].includes(package_name)
}

const guessReleaseNotes = async (context, issue) => {
    if (!issue.pull_request
        &&issue.labels.filter(label => label.name === 'component-update').length !== 1) throw new Error(`Cannot determine release note from issue ${issue.number}`)
    let { package_name, version } = guessComponentUpdateDetails(issue.title, issue.body)

    package_name = prettyPackageName(package_name.replace(/^mingw-w64-/, ''))

    const matchURLInIssue = (issue) => {
        const match = issue.body.match(package_name.toLowerCase() === 'bash'
            ? /(?:^|\n)(https:\/\/\S+)/ // for `bash`, use the first URL
            : /(?:^|\n)(https:\/\/\S+)$/)
        return match && match[1]
    }

    const matchURL = async () => {
        if (!issue.pull_request) return matchURLInIssue(issue)

        const match = issue.body.match(/See (https:\/\/\S+) for details/)
        if (match) return match[1]

        const issueMatch = issue.body.match(/https:\/\/github\.com\/git-for-windows\/git\/issues\/(\d+)/)
        if (issueMatch) {
            const githubApiRequest = require('./github-api-request')
            const issue = await githubApiRequest(
                context,
                null,
                'GET',
                `/repos/git-for-windows/git/issues/${issueMatch[1]}`
            )
            return matchURLInIssue(issue)
        }
    }

    const url = await matchURL()
    if (!url) throw new Error(`Could not determine URL from issue ${issue.number}`)
    return {
        type: 'feature',
        message: `Comes with [${package_name} v${version}](${url}).`
    }
}

module.exports = {
    guessComponentUpdateDetails,
    guessReleaseNotes,
    prettyPackageName,
    isMSYSPackage,
    needsSeparateARM64Build
}