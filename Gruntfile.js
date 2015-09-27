module.exports = function (grunt) {

    // 项目配置

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        uglify: {

            //options: {
            //    banner: '/*! <%= pkg.file %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            //},

            build: {

                src: 'src/<%=pkg.file %>.js',
                dest: 'dest/<%= pkg.file %>_<%= pkg.version %>.min.js'
                //files: {
                //    'dest/<%= pkg.file %>_<%= pkg.version %>.min.js': 'src/<%=pkg.file %>.js',
                //    'src/<%= pkg.file %>_<%= pkg.version %>.js': 'src/<%=pkg.file %>.js'
                //}

            }

        },

        concat: {

            build: {

                src: 'src/<%=pkg.file %>.js',

                dest: 'src/<%= pkg.file %>_<%= pkg.version %>.js'

            }

        }

    });

    // 加载提供"uglify"任务的插件

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');

    // 默认任务

    grunt.registerTask('default', ['uglify','concat']);

}