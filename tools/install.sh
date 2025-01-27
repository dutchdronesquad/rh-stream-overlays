#!/bin/bash
set -e
set -u

# Define paths
readonly PLUGIN_DIR=~/RotorHazard/src/server/plugins
readonly PLUGIN_DOMAIN="stream_overlays"
readonly REPOSITORY="dutchdronesquad/rh-stream-overlays"

# Function to download and extract a zip file
download_and_extract() {
    local url=$1
    local temp_zip=~/temp.zip
    local folder_name

    echo "Downloading from $url..."
    if ! wget "$url" -O "$temp_zip"; then
        echo "Error: Failed to download the project from $url."
        exit 1
    fi

    echo "Extracting the downloaded zip file..."
    if ! unzip -q "$temp_zip" -d ~; then
        echo "Error: Failed to unzip the files."
        rm $temp_zip
        exit 1
    fi

    folder_name=$(unzip -Z1 $temp_zip | head -1 | cut -d'/' -f1)
    if [ -z "$folder_name" ]; then
        echo "Error: Unable to determine the folder name from the zip file."
        rm $temp_zip
        exit 1
    fi

    local target_dir=$PLUGIN_DIR
    echo "Moving the files to $target_dir"
    if ! mv ~/$folder_name/custom_plugins/$PLUGIN_DOMAIN $target_dir; then
        echo "Error: Failed to move the plugin directory."
        cleanup $temp_zip $folder_name
        exit 1
    fi

    echo "Cleaning up temporary files"
    cleanup $temp_zip $folder_name

    echo "Installation/update completed successfully!"
}

# Function to clean up temporary files
cleanup() {
    local temp_zip=$1
    local folder_name=$2
    rm -R ~/$folder_name
    rm $temp_zip
}

# Function to fetch the latest releases
fetch_latest_releases() {
    local releases_json
    mapfile -t releases_json < <(curl -s "https://api.github.com/repos/$REPOSITORY/releases" | jq -r '.[].tag_name' | head -n 5)
    printf "%s\n" "${releases_json[@]}"
}

# Function to ask if the user wants to update the existing plugin
check_update_permission() {
    if [ -d "$PLUGIN_DIR/$PLUGIN_DOMAIN" ]; then
        echo "The plugin already exists in RotorHazard."
        read -rp "Do you want to update it? (y/n): " update_choice

        case "$update_choice" in
            y|Y)
                echo "Removing the existing plugin directory..."
                if rm -rf "$PLUGIN_DIR/$PLUGIN_DOMAIN"; then
                    echo "Plugin directory removed successfully."
                else
                    echo "Failed to remove plugin directory."
                    exit 1
                fi
                ;;
            n|N)
                echo "Update cancelled."
                exit 0
                ;;
            *)
                echo "Invalid choice. Please enter y or n."
                check_update_permission
                ;;
        esac
    fi
}

# Function to install/update the plugin to the specified release
install_stable_plugin() {
    echo "Fetching the latest stable release versions..."
    local latest_releases
    mapfile -t latest_releases < <(fetch_latest_releases)

    if [ ${#latest_releases[@]} -eq 0 ]; then
        echo "Error: Unable to fetch the latest release versions."
        exit 1
    fi

    echo "Select a release version to install:"
    PS3="Enter your choice [1-${#latest_releases[@]}]: "
    select release_version in "${latest_releases[@]}"; do
        if [[ " ${latest_releases[*]} " =~ ${release_version} ]]; then
            local download_url="https://codeload.github.com/$REPOSITORY/zip/refs/tags/$release_version"
            break
        else
            echo "Invalid selection. Please try again."
        fi
    done

    # Check if the plugin already exists and ask for update permission
    check_update_permission
    download_and_extract $download_url
}

# Function to install/update the plugin to the development version
install_development_plugin() {
    local branch="develop"
    local download_url="https://codeload.github.com/$REPOSITORY/zip/refs/heads/$branch"

    # Check if the plugin already exists and ask for update permission
    check_update_permission
    download_and_extract $download_url
}

# Function to display a menu and get user choice
display_menu() {
    local menu_choice

    echo "-------------------------------------------"
    echo " DDS Stream Overlays Plugin Installer "
    echo "-------------------------------------------"
    echo "Please select an option:"
    echo "1) Install the stable release"
    echo "2) Install the development version"
    echo "3) Cancel"
    echo "-------------------------------------------"
    read -rp "Enter your choice [1-3]: " menu_choice
    echo "-------------------------------------------"

    case "$menu_choice" in
        1)
            handle_plugin_choice "stable"
            ;;
        2)
            handle_plugin_choice "development"
            ;;
        3)
            echo "Installation cancelled."
            exit 0
            ;;
        *)
            echo "Error: Invalid choice. Please enter a number between 1 and 3."
            display_menu
            ;;
    esac
}

# Function to handle user's plugin choice
handle_plugin_choice() {
    local plugin_type=$1

    # Install or update based on plugin type
    if [ "$plugin_type" = "stable" ]; then
        install_stable_plugin
    elif [ "$plugin_type" = "development" ]; then
        install_development_plugin
    fi
}

# Main execution starts here
display_menu
