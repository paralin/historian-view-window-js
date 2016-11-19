node {
  stage ("node v6") {
    sh '''
      #!/bin/bash
      set +x
      source ~/.nvm/nvm.sh
      nvm install 6
    '''
  }

  stage ("scm") {
    checkout scm
    sh './jenkins_scripts/jenkins_setup_git.bash'
  }

  env.CACHE_CONTEXT='remote-state-stream'
  wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'XTerm']) {
    stage ("cache-download") {
      sh '''
        #!/bin/bash
        source ./jenkins_scripts/jenkins_env.bash
        ./jenkins_scripts/init_cache.bash
      '''
    }

    stage ("install") {
      sh '''
        #!/bin/bash
        source ./jenkins_scripts/jenkins_env.bash
        enable-npm-proxy
        npm install
        npm prune
      '''
    }

    stage ("cache-upload") {
      sh '''
        #!/bin/bash
        source ./jenkins_scripts/jenkins_env.bash
        ./jenkins_scripts/finalize_cache.bash
      '''
    }

    stage ("test") {
      sh '''
        #!/bin/bash
        source ./jenkins_scripts/jenkins_env.bash
        npm run ci
      '''
    }

    stage ("release") {
      sh '''
        #!/bin/bash
        source ./jenkins_scripts/jenkins_env.bash
        ./jenkins_scripts/jenkins_release.bash
      '''
    }
  }
}
