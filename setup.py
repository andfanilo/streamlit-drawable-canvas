from os.path import dirname
from os.path import join
import setuptools


def readme() -> str:
    """Utility function to read the README file.
    Used for the long_description.  It's nice, because now 1) we have a top
    level README file and 2) it's easier to type in the README file than to put
    a raw string in below.
    :return: content of README.md
    """
    return open(join(dirname(__file__), "README.md")).read()


setuptools.setup(
    name="streamlit-drawable-canvas",
    version="0.10.0",
    author="Fanilo ANDRIANASOLO",
    author_email="andfanilo@gmail.com",
    description="A Streamlit custom component for a free drawing canvas using Fabric.js.",
    long_description=readme(),
    long_description_content_type="text/markdown",
    url="https://github.com/andfanilo/streamlit-drawable-canvas",
    packages=setuptools.find_packages(),
    include_package_data=True,
    classifiers=[],
    python_requires=">=3.6",
    install_requires=[
        "Pillow",
        "numpy",
        "streamlit >= 0.63",
    ]
)
